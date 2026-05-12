import { atom } from "jotai"
import { buildParams } from "../commands/buildParams"
import { apiRunModalAtom } from "../components/ApiRunModal/apiRunModalAtom"
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
        await fetch(`/jobs/${step.jobId}`, {
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

    set(runningAtom, true)
    set(apiRunModalAtom, {
      jobId: null,
      status: "pending",
      logs: [],
      childJobId: null,
      childStepId: null,
      source: "step",
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
        set(apiRunModalAtom, (prev) =>
          prev ? { ...prev, status: "failed" } : prev,
        )
        set(runningAtom, false)
        return
      }
      const data = (await response.json()) as {
        jobId: string
      }
      set(apiRunModalAtom, (prev) =>
        prev
          ? {
              ...prev,
              jobId: data.jobId,
              status: "running",
            }
          : prev,
      )
    } catch {
      set(apiRunModalAtom, (prev) =>
        prev ? { ...prev, status: "failed" } : prev,
      )
      set(runningAtom, false)
    }
  },
)
