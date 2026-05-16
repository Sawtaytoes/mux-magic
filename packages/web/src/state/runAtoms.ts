import type { CreateJobResponse } from "@mux-magic/server/api-types"
import { atom } from "jotai"
import { apiBase } from "../apiBase"
import { buildParams } from "../commands/buildParams"
import { isGroup } from "../jobs/sequenceUtils"
import type {
  PathVariable,
  SequenceItem,
  Step,
} from "../types"
import { commandsAtom } from "./commandsAtom"
import {
  buildRunFetchUrl,
  dryRunAtom,
  failureModeAtom,
} from "./dryRunQuery"
import { pathsAtom } from "./pathsAtom"
import { setStepRunStatusAtom } from "./stepAtoms"
import { stepsAtom } from "./stepsAtom"

// True while ANY run (single step, group, or full sequence) is in
// flight. runOrStopStepAtom (this file) writes it; runViaApi and
// runGroup in useBuilderActions also write it. Read by every "▶ Run"
// button to guard against concurrent runs.
export const runningAtom = atom<boolean>(false)

// ─── Param resolution for the /commands/:name endpoint ────────────────────────
//
// /sequences/run resolves `@pathId` references server-side using the
// `paths` YAML block; /commands/:name takes already-resolved params.
// runOrStopStepAtom posts to /commands/:name (B4: produces a single
// flat job per step instead of an umbrella+child), so the client
// expands `@pathId` strings to their values from pathsAtom before
// sending.
const resolveParams = (
  params: Record<string, unknown>,
  paths: PathVariable[],
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (
        typeof value === "string" &&
        value.startsWith("@")
      ) {
        const pathVariableId = value.slice(1)
        const pathVariable = paths.find(
          (candidate) => candidate.id === pathVariableId,
        )
        // Fall back to the raw `@id` string when the path var is
        // missing so the server's per-command validation surfaces
        // a clear error rather than silently dropping the field.
        return [key, pathVariable?.value ?? value]
      }
      return [key, value]
    }),
  )
}

// A single-step run hits /commands/:name which expects already-resolved
// scalars. `linkedTo` references belong to /sequences/run — they point at
// another step's runtime output, which doesn't exist outside a sequence
// run. Detect them client-side so the user gets a directive message
// (change the field, or run the whole sequence) instead of an opaque
// 400/ZodError surfacing through the validation path.
const findUnresolvableLink = (
  params: Record<string, unknown>,
): { field: string; targetStepId: string } | null => {
  const entry = Object.entries(params).find(
    ([, value]) =>
      value !== null &&
      typeof value === "object" &&
      typeof (value as { linkedTo?: unknown }).linkedTo ===
        "string",
  )
  if (!entry) return null
  const [field, value] = entry
  return {
    field,
    targetStepId: (value as { linkedTo: string }).linkedTo,
  }
}

// @hono/zod-openapi ships validation failures as
//   { success: false, error: { issues: [{ path, message, ... }], name: 'ZodError' } }
// Other routes return the simpler `{ error: string }` shape. Pick the
// most specific human-readable message available; "Request failed"
// is the last-resort fallback so the UI always has *something* to show.
const extractRequestErrorMessage = (
  body: unknown,
): string => {
  if (body && typeof body === "object") {
    const bodyRecord = body as Record<string, unknown>
    const innerError = bodyRecord.error
    if (innerError && typeof innerError === "object") {
      const issues = (innerError as { issues?: unknown })
        .issues
      if (Array.isArray(issues) && issues.length > 0) {
        const issue = issues[0] as {
          message?: unknown
          path?: unknown
        }
        const path = Array.isArray(issue.path)
          ? issue.path.join(".")
          : ""
        const message =
          typeof issue.message === "string"
            ? issue.message
            : "Invalid value"
        return path ? `${path}: ${message}` : message
      }
    }
    if (typeof innerError === "string") return innerError
  }
  return "Request failed"
}

const findStep = (
  items: SequenceItem[],
  stepId: string,
): Step | undefined => {
  let found: Step | undefined
  items.forEach((item) => {
    if (found) return
    if (isGroup(item)) {
      const inner = item.steps.find(
        (step) => step.id === stepId,
      )
      if (inner) found = inner
    } else if (item.id === stepId) {
      found = item as Step
    }
  })
  return found
}

// ─── Per-step run / cancel ────────────────────────────────────────────────────
// Replaces the window.runOrStopStep bridge global (W5 parity-trap port).

export const runOrStopStepAtom = atom(
  null,
  async (get, set, stepId: string) => {
    const items = get(stepsAtom)
    const step = findStep(items, stepId)
    if (!step) return

    // Cancel an in-flight step run.
    if (step.status === "running" && step.jobId) {
      try {
        await fetch(`${apiBase}/jobs/${step.jobId}`, {
          method: "DELETE",
        })
      } catch {
        // Best-effort cancel — let the UI poll for the final status.
      }
      return
    }

    // Guard against a concurrent global run.
    if (get(runningAtom)) return

    // Can't run a step with no command selected.
    if (!step.command) return

    const paths = get(pathsAtom)
    const commands = get(commandsAtom)
    const commandDefinition = commands[step.command]
    // Build the YAML-form params (folds step.links into @pathId
    // strings + {linkedTo,output} objects), then resolve @pathId
    // strings to actual values for the /commands/:name endpoint.
    const yamlFormParams = commandDefinition
      ? buildParams(step, commandDefinition)
      : step.params
    const resolvedParams = resolveParams(
      yamlFormParams,
      paths,
    )

    // Single-step preflight: /commands/:name can't resolve a linkedTo
    // reference because there's no prior step to read outputs from.
    // Surface the explicit "change the field or run the whole sequence"
    // choice the user needs to make rather than letting a Zod ValidationError
    // come back as an opaque "failed" status.
    const unresolvableLink =
      findUnresolvableLink(resolvedParams)
    if (unresolvableLink) {
      set(setStepRunStatusAtom, {
        stepId,
        status: "failed",
        error: `${unresolvableLink.field} is linked to ${unresolvableLink.targetStepId}'s output, which only resolves during a full sequence run. Change ${unresolvableLink.field} to a concrete path, or run the whole sequence.`,
      })
      return
    }

    set(runningAtom, true)
    set(setStepRunStatusAtom, {
      stepId,
      status: "running",
      error: null,
    })

    // B4 fix: single-step runs hit /commands/:name (creates one flat
    // job) instead of /sequences/run (creates umbrella + child). The
    // dry-run gate from P0 still applies — buildRunFetchUrl appends
    // ?fake=success / ?fake=failure when the DRY RUN badge is on.
    const runUrl = buildRunFetchUrl(
      `/commands/${step.command}`,
      {
        isDryRun: get(dryRunAtom),
        isFailureMode: get(failureModeAtom),
      },
    )

    try {
      const response = await fetch(runUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resolvedParams),
      })
      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => null)
        set(setStepRunStatusAtom, {
          stepId,
          status: "failed",
          error: extractRequestErrorMessage(errorBody),
        })
        set(runningAtom, false)
        return
      }
      const data =
        (await response.json()) as CreateJobResponse
      set(setStepRunStatusAtom, {
        stepId,
        status: "running",
        jobId: data.jobId,
      })
      // The SSE subscription + done-event handling now lives in
      // StepRunProgress (one EventSource per running step). Opening one
      // here too would double the /jobs/:id/logs subscriptions and the
      // browser would replay buffered events to both clients.
    } catch (error) {
      set(setStepRunStatusAtom, {
        stepId,
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Network error",
      })
      set(runningAtom, false)
    }
  },
)
