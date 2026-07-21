import type { CreateJobResponse } from "@mux-magic/api/api-types"
import { atom } from "jotai"
import { apiBase } from "../apiBase"
import { buildParams } from "../commands/buildParams"
import type { Commands } from "../commands/types"
import { getVariableTypeDefinition } from "../components/VariableCard/registry"
import { isGroup } from "../jobs/sequenceUtils"
import type { SequenceItem, Step, Variable } from "../types"
import { commandsAtom } from "./commandsAtom"
import {
  buildRunFetchUrl,
  dryRunAtom,
  failureModeAtom,
} from "./dryRunQuery"
import { setStepRunStatusAtom } from "./stepAtoms"
import { stepsAtom } from "./stepsAtom"
import { variablesAtom } from "./variablesAtom"

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
  variables: Variable[],
  items: SequenceItem[],
  commands: Commands,
  visiting: Set<string>,
) => {
  const link = step.links?.[field]
  if (typeof link === "string") {
    const variable = variables.find(
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
      variables,
      items,
      commands,
      visiting,
    )
  }
  const value = step.params[field]
  return typeof value === "string" ? value : null
}

// Mirrors the server's computeStepFolderOutput
// (packages/api/src/api/resolveSequenceParams.ts). Same precedence:
// parentOfSource → outputFolderName → destinationPath →
// destinationFilesPath → sourcePath. Returns null when the chain can't
// be resolved (unknown step, unknown command, cycle).
// Explicit return type breaks the mutual-recursion inference cycle with
// resolveScalarField. Without it TS can't infer either one (TS7023).
const resolveFolderOutput = (
  targetStepId: string,
  variables: Variable[],
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
    variables,
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
      variables,
      items,
      commands,
      nextVisiting,
    ) ??
    resolveScalarField(
      target,
      "destinationFilesPath",
      variables,
      items,
      commands,
      nextVisiting,
    )
  if (destination) return destination
  return stripped
}

const resolveParams = (
  params: Record<string, unknown>,
  variables: Variable[],
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
      const variable = variables.find(
        (candidate) => candidate.id === variableId,
      )
      // Fall back to the raw `@id` string when the variable is
      // missing so the server's per-command validation surfaces a
      // clear error rather than silently dropping the field.
      if (!variable) {
        resolved[key] = value
        return
      }
      // Variables always store .value as a string. Numeric types
      // (dvdCompareId, threadCount) declare runtimeValueType: "number"
      // so the @-resolver coerces here — otherwise the request hits
      // zod with a string and trips an "expected number" error. NaN
      // (e.g. a dvdCompareId slug like "spider-man-2002") falls
      // through as the raw string so zod's error names the offending
      // value rather than reporting NaN.
      const definition = getVariableTypeDefinition(
        variable.type,
      )
      if (definition?.runtimeValueType === "number") {
        const coerced = Number(variable.value)
        resolved[key] = Number.isFinite(coerced)
          ? coerced
          : variable.value
        return
      }
      resolved[key] = variable.value
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
        variables,
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

// A single Zod issue rendered as "path: message". For an enum failure Zod 4
// inlines the *entire* allowed-value list into the issue's own `message`
// (every ISO-639-2 code for a language field — hundreds of entries), which
// is unreadable on a card. Replace it with a short, capped hint that still
// names what was expected.
const ENUM_HINT_LIMIT = 8

const describeZodIssue = (raw: unknown) => {
  const issue = (
    raw && typeof raw === "object" ? raw : {}
  ) as {
    code?: unknown
    message?: unknown
    values?: unknown
    path?: unknown
  }
  const path =
    Array.isArray(issue.path) && issue.path.length > 0
      ? issue.path.join(".")
      : ""
  const isEnumFailure =
    (issue.code === "invalid_value" ||
      issue.code === "invalid_enum_value") &&
    Array.isArray(issue.values)
  let message: string
  if (isEnumFailure) {
    const values = issue.values as unknown[]
    const hint = values.slice(0, ENUM_HINT_LIMIT).join(", ")
    const overflow =
      values.length > ENUM_HINT_LIMIT ? ", …" : ""
    message = `invalid value (expected one of: ${hint}${overflow})`
  } else {
    message =
      typeof issue.message === "string"
        ? issue.message
        : "Invalid value"
  }
  return path ? `${path}: ${message}` : message
}

// Recover the issue list from a @hono/zod-openapi validation body. The
// documented shape is { success: false, error: { name: 'ZodError', issues,
// message } }, but in Zod 4 the serialized error keeps only { name, message
// } — `issues` is a non-enumerable getter that does NOT survive
// JSON.stringify, so the real payload carries the issues as a JSON string
// inside `message`. Read from whichever is present.
const readZodIssues = (
  innerError: Record<string, unknown>,
): unknown[] | null => {
  const direct = innerError.issues
  if (Array.isArray(direct) && direct.length > 0) {
    return direct
  }
  const message = innerError.message
  if (typeof message === "string") {
    const trimmed = message.trim()
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      } catch {
        // Not a JSON issue list — fall back to the raw message below.
      }
    }
  }
  return null
}

// Pick the most specific human-readable message available. Other routes
// return the simpler `{ error: string }` shape. "Request failed" is the
// last-resort fallback so the UI always has *something* to show.
const extractRequestErrorMessage = (body: unknown) => {
  if (body && typeof body === "object") {
    const bodyRecord = body as Record<string, unknown>
    const innerError = bodyRecord.error
    if (innerError && typeof innerError === "object") {
      const issues = readZodIssues(
        innerError as Record<string, unknown>,
      )
      if (issues) {
        return issues.map(describeZodIssue).join("; ")
      }
      // ZodError whose message wasn't a JSON issue list, or any other
      // object error carrying a plain human-readable message string.
      const message = (innerError as { message?: unknown })
        .message
      if (typeof message === "string" && message.trim()) {
        return message
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

    const variables = get(variablesAtom)
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
        variables,
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
