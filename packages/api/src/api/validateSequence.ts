// Static ("no run") validation of a sequence document. The route handler
// first applies the envelope schema (validatedParsedSequenceSchema — unique
// step ids, no parallel-sibling links, known command names, `@ref` format);
// this module adds the second half the runner does at runtime
// (sequenceRunner.ts, per-step `config.schema.safeParse(resolved)`), lifted
// ahead of execution so a bad sequence is caught before any file is touched.
//
// It walks the flat step list in order, resolving `@path` variables and
// `{ linkedTo, output: 'folder' }` references exactly like the runner
// (reusing resolveSequenceParams), then validates each step's resolved params
// against that command's request schema. Named step-output links
// (`{ linkedTo, output: <name> }`) can't be resolved without running, so they
// are substituted with a placeholder string after confirming the target step
// exists — enough to satisfy the receiving path field without a false error.

import {
  resolveSequenceParams,
  type SequencePath,
  type StepRuntimeRecord,
} from "./resolveSequenceParams.js"
import {
  type CommandConfig,
  commandConfigs,
} from "./routes/commandRoutes.js"
import type {
  SequenceBody,
  SequenceItem,
  SequenceStep,
} from "./sequenceRunner.js"

export type SequenceValidationError = {
  stepId?: string
  command?: string
  message: string
}

export type SequenceValidationResult = {
  isValid: boolean
  errors: SequenceValidationError[]
}

const NAMED_OUTPUT_PLACEHOLDER =
  "__unresolved_step_output__"

const flattenSteps = (
  items: SequenceItem[],
): SequenceStep[] =>
  items.flatMap((item): SequenceStep[] =>
    item.kind === "group"
      ? item.steps.filter((step) => step.command !== "")
      : item.command === ""
        ? []
        : [item],
  )

const isLinkedToObject = (
  value: unknown,
): value is { linkedTo: string; output?: string } =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as Record<string, unknown>).linkedTo ===
    "string"

// Replace `{ linkedTo, output: <named> }` values (which need a prior step's
// runtime output that doesn't exist without running) with a placeholder
// string, but only after confirming the target step id was seen earlier.
// `@ref` and `{ linkedTo, output: 'folder' }` are left for
// resolveSequenceParams to resolve for real.
const substituteNamedOutputLinks = (
  rawParams: Record<string, unknown>,
  seenStepIds: Set<string>,
  errors: SequenceValidationError[],
  stepId: string | undefined,
  command: string,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  Object.entries(rawParams).forEach(([key, value]) => {
    if (
      isLinkedToObject(value) &&
      value.output !== undefined &&
      value.output !== "folder"
    ) {
      if (!seenStepIds.has(value.linkedTo)) {
        errors.push({
          command,
          message: `Param "${key}" links to step "${value.linkedTo}" which has not run yet (or doesn't exist).`,
          stepId,
        })
      }
      result[key] = NAMED_OUTPUT_PLACEHOLDER
      return
    }
    result[key] = value
  })
  return result
}

export const validateSequenceParams = (
  parsed: SequenceBody,
): SequenceValidationResult => {
  const errors: SequenceValidationError[] = []

  const pathsById: Record<string, SequencePath> = {
    ...parsed.paths,
    ...parsed.variables,
  }

  // Records accumulate as we walk so downstream folder links resolve against
  // the real resolved sourcePath of an earlier step — mirroring the runner.
  const stepsById: Record<string, StepRuntimeRecord> = {}
  const seenStepIds = new Set<string>()

  flattenSteps(parsed.steps ?? []).forEach((step) => {
    const command = step.command
    const config = (
      commandConfigs as Record<
        string,
        CommandConfig | undefined
      >
    )[command]
    if (!config) {
      // Unknown command — the envelope schema already reports this, but guard
      // so param validation doesn't throw on a missing config.
      return
    }

    const rawParams = substituteNamedOutputLinks(
      step.params ?? {},
      seenStepIds,
      errors,
      step.id,
      command,
    )

    const { resolved, errors: resolveErrors } =
      resolveSequenceParams({
        commandConfigsByName: commandConfigs,
        pathsById,
        rawParams,
        stepsById,
      })

    resolveErrors.forEach((message) => {
      errors.push({ command, message, stepId: step.id })
    })

    const validation = config.schema.safeParse(resolved)
    if (!validation.success) {
      validation.error.issues.forEach(
        (issue: {
          path: (string | number | symbol)[]
          message: string
        }) => {
          const path = issue.path.join(".")
          errors.push({
            command,
            message: path
              ? `${path}: ${issue.message}`
              : issue.message,
            stepId: step.id,
          })
        },
      )
    }

    if (step.id !== undefined) {
      stepsById[step.id] = {
        command,
        outputs: null,
        resolvedParams: resolved,
      }
      seenStepIds.add(step.id)
    }
  })

  return { errors, isValid: errors.length === 0 }
}
