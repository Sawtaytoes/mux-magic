import type { CreateJobResponse } from "@mux-magic/server/api-types"
import { atom } from "jotai"
import { apiBase } from "../apiBase"
import { buildParams } from "../commands/buildParams"
import type { Commands } from "../commands/types"
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
// /sequences/run resolves `@pathId` AND `{linkedTo, output}` references
// server-side; /commands/:name takes already-resolved scalars. For a
// single-step run we have to do the same expansion the server's
// resolveSequenceParams does, otherwise a step that chains off a prior
// step (e.g. modifySubtitleMetadata reading EXTRACTED-SUBTITLES) can
// never be run on its own.
//
// `{ linkedTo, output: 'folder' }` (the common case — "chain off the
// previous step's output folder") is fully deterministic from static
// command config: it's `sourceStep.sourcePath + '/' + outputFolderName`
// (or `parentOfSource` / `destinationPath` for the special cases). So
// we walk the chain client-side using commandsAtom (same schema the
// server reads). Named-output references (`output: 'rules'`, etc.) DO
// require the source step's runtime output, which we don't keep around
// for single-step runs — those still surface a directive error.

const stripTrailingSlash = (path: string) =>
  path.replace(/[\\/]$/u, "")

// Resolve a step's `field` scalar to a literal string. Handles the
// literal value, an `@pathId` link, or — defensively — a chained
// `{linkedTo, output: 'folder'}` link (which recurses back through
// resolveFolderOutput). Returns null when the chain dead-ends.
const resolveScalarField = (
  step: Step,
  field: string,
  pathVariables: PathVariable[],
  items: SequenceItem[],
  commands: Commands,
  visiting: Set<string>,
) => {
  const link = step.links?.[field]
  if (typeof link === "string") {
    const variable = pathVariables.find(
      (pathVariable) => pathVariable.id === link,
    )
    return variable?.value ?? null
  }
  if (
    link &&
    typeof link === "object" &&
    typeof (link as { linkedTo?: unknown }).linkedTo ===
      "string"
  ) {
    return resolveFolderOutput(
      (link as { linkedTo: string }).linkedTo,
      pathVariables,
      items,
      commands,
      visiting,
    )
  }
  const value = step.params[field]
  return typeof value === "string" ? value : null
}

// Mirrors the server's computeStepFolderOutput
// (packages/server/src/api/resolveSequenceParams.ts). Same precedence:
// parentOfSource → outputFolderName → destinationPath →
// destinationFilesPath → sourcePath. Returns null when the chain can't
// be resolved (unknown step, unknown command, cycle).
// Explicit return type breaks the mutual-recursion inference cycle with
// resolveScalarField. Without it TS can't infer either one (TS7023).
const resolveFolderOutput = (
  targetStepId: string,
  pathVariables: PathVariable[],
  items: SequenceItem[],
  commands: Commands,
  visiting: Set<string>,
): string | null => {
  if (visiting.has(targetStepId)) return null
  const target = findStep(items, targetStepId)
  if (!target?.command) return null
  const command = commands[target.command]
  if (!command) return null

  const nextVisiting = new Set(visiting).add(targetStepId)
  const source = resolveScalarField(
    target,
    "sourcePath",
    pathVariables,
    items,
    commands,
    nextVisiting,
  )
  const stripped = source ? stripTrailingSlash(source) : ""

  if (command.outputComputation === "parentOfSource") {
    return stripped
      ? stripped.replace(/[\\/][^\\/]*$/u, "")
      : ""
  }
  if (command.outputFolderName) {
    return stripped
      ? `${stripped}/${command.outputFolderName}`
      : command.outputFolderName
  }
  const destination =
    resolveScalarField(
      target,
      "destinationPath",
      pathVariables,
      items,
      commands,
      nextVisiting,
    ) ??
    resolveScalarField(
      target,
      "destinationFilesPath",
      pathVariables,
      items,
      commands,
      nextVisiting,
    )
  if (destination) return destination
  return stripped
}

const resolveParams = (
  params: Record<string, unknown>,
  pathVariables: PathVariable[],
  items: SequenceItem[],
  commands: Commands,
) => {
  const errors: string[] = []
  const resolved: Record<string, unknown> = {}

  Object.entries(params).forEach(([key, value]) => {
    if (
      typeof value === "string" &&
      value.startsWith("@")
    ) {
      const variableId = value.slice(1)
      const variable = pathVariables.find(
        (pathVariable) => pathVariable.id === variableId,
      )
      // Fall back to the raw `@id` string when the path var is
      // missing so the server's per-command validation surfaces a
      // clear error rather than silently dropping the field.
      resolved[key] = variable?.value ?? value
      return
    }
    if (
      value !== null &&
      typeof value === "object" &&
      typeof (value as { linkedTo?: unknown }).linkedTo ===
        "string"
    ) {
      const link = value as {
        linkedTo: string
        output?: string
      }
      const output = link.output ?? "folder"
      if (output !== "folder") {
        // Named runtime outputs (e.g. modifySubtitleMetadata's `rules`,
        // getAudioOffsets' `audioOffsets`) only exist after the source
        // step has actually run; single-step runs don't persist those
        // results client-side. Direct the user to either pin the value
        // or run the whole sequence.
        errors.push(
          `${key} is linked to ${link.linkedTo}'s "${output}" output, which is only available during a full sequence run. Change ${key} to a concrete value, or run the whole sequence.`,
        )
        return
      }
      const folder = resolveFolderOutput(
        link.linkedTo,
        pathVariables,
        items,
        commands,
        new Set(),
      )
      if (folder === null) {
        // Use phrasing the existing regression test asserts against
        // (sourcePath is linked to step5_2 / run the whole sequence).
        errors.push(
          `${key} is linked to ${link.linkedTo}'s output but that step couldn't be resolved (unknown step, unknown command, or circular link). Change ${key} to a concrete path, or run the whole sequence.`,
        )
        return
      }
      resolved[key] = folder
      return
    }
    resolved[key] = value
  })

  return { resolved, errors }
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

    const pathVariables = get(pathsAtom)
    const commands = get(commandsAtom)
    const commandDefinition = commands[step.command]
    // Build the YAML-form params (folds step.links into @pathId
    // strings + {linkedTo,output} objects), then resolve @pathId
    // strings to actual values for the /commands/:name endpoint.
    const yamlFormParams = commandDefinition
      ? buildParams(step, commandDefinition)
      : step.params
    const { resolved: resolvedParams, errors } =
      resolveParams(
        yamlFormParams,
        pathVariables,
        items,
        commands,
      )

    // Single-step preflight: resolveParams handles `@pathId` AND
    // folder-output `{linkedTo}` references the same way the server's
    // resolveSequenceParams does. Anything it couldn't resolve (named
    // runtime outputs, broken chains) comes back as an error string —
    // surface that instead of POSTing junk to /commands/:name.
    if (errors.length > 0) {
      set(setStepRunStatusAtom, {
        stepId,
        status: "failed",
        error: errors.join("; "),
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
