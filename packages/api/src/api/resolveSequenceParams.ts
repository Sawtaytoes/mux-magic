import type { CommandConfig } from "./routes/commandRoutes.js"

// Server-side mirror of the builder's buildParams resolver. Walks every
// value in a step's raw params, replacing the two link forms with their
// resolved values:
//
//   '@pathId'                      → paths[pathId].value
//   { linkedTo, output: 'folder' } → synthesized folder of the prior step
//   { linkedTo, output: <name> }   → priorStep.outputs[name]
//
// Anything else is returned as-is. The function is pure: pass it the raw
// step params plus the lookup tables (paths from the YAML's top-level
// `paths` block, and the runtime outputs / resolved params accumulated as
// each prior step ran), and you get back resolved params + any errors
// encountered (missing references, etc.) for the caller to surface.

export type SequencePath = {
  label?: string
  value: string
}

export type StepRuntimeRecord = {
  command: string
  // The step's already-resolved params (used to compute the synthesized
  // folder output for downstream steps). Indexed by source-path field
  // name with the value being the resolved path string.
  resolvedParams: Record<string, unknown>
  // Whatever the command's extractOutputs projector produced when this
  // step finished. Null when the command didn't declare any outputs.
  outputs: Record<string, unknown> | null
}

export type ResolveResult = {
  resolved: Record<string, unknown>
  errors: string[]
}

// Worker 24 codified `sourcePath` as the universal primary-input field name
// across every command. The previous legacy aliases (sourceFilesPath,
// mediaFilesPath) are no longer declared by any command schema, so a
// single-entry list suffices.
const MAIN_SOURCE_FIELD_NAMES = ["sourcePath"] as const

const stripTrailingSlash = (path: string): string =>
  path.replace(/[\\/]$/u, "")

// Mirrors the builder's stepOutput() (see public/api/builder/index.html).
// Given a previously-executed step, derives the path string a downstream
// `{ linkedTo, output: 'folder' }` reference should resolve to.
const computeStepFolderOutput = (
  step: StepRuntimeRecord,
  config: CommandConfig,
): string => {
  const mainSourceField = MAIN_SOURCE_FIELD_NAMES.find(
    (name) =>
      typeof step.resolvedParams[name] === "string" &&
      step.resolvedParams[name] !== "",
  )
  const sourcePath = mainSourceField
    ? stripTrailingSlash(
        String(step.resolvedParams[mainSourceField]),
      )
    : ""

  // 'parentOfSource': the command writes into dirname(sourcePath), so
  // downstream chains should anchor on the parent. Used by flattenOutput.
  if (config.outputComputation === "parentOfSource") {
    return sourcePath
      ? sourcePath.replace(/[\\/][^\\/]*$/u, "")
      : ""
  }

  if (config.outputFolderName) {
    return sourcePath
      ? `${sourcePath}/${config.outputFolderName}`
      : config.outputFolderName
  }

  const destinationPath =
    step.resolvedParams.destinationPath
  if (
    typeof destinationPath === "string" &&
    destinationPath !== ""
  ) {
    return destinationPath
  }

  const destinationFilesPath =
    step.resolvedParams.destinationFilesPath
  if (
    typeof destinationFilesPath === "string" &&
    destinationFilesPath !== ""
  ) {
    return destinationFilesPath
  }

  return sourcePath
}

const isLinkedToObject = (
  value: unknown,
): value is { linkedTo: string; output?: string } =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as Record<string, unknown>).linkedTo ===
    "string"

export const resolveSequenceParams = ({
  rawParams,
  pathsById,
  stepsById,
  commandConfigsByName,
}: {
  rawParams: Record<string, unknown>
  pathsById: Record<string, SequencePath>
  stepsById: Record<string, StepRuntimeRecord>
  commandConfigsByName: Partial<
    Record<string, CommandConfig>
  >
}): ResolveResult => {
  const errors: string[] = []
  const resolved: Record<string, unknown> = {}

  Object.entries(rawParams).forEach(([key, value]) => {
    // Path-variable reference: '@pathId'.
    if (
      typeof value === "string" &&
      value.startsWith("@")
    ) {
      const pathId = value.slice(1)
      const path = pathsById[pathId]
      if (!path) {
        errors.push(
          `Unknown path variable "${pathId}" referenced by param "${key}".`,
        )
        return
      }
      resolved[key] = path.value
      return
    }

    // Step-output reference: { linkedTo, output }.
    if (isLinkedToObject(value)) {
      const sourceStep = stepsById[value.linkedTo]
      if (!sourceStep) {
        errors.push(
          `Param "${key}" links to step "${value.linkedTo}" which has not run yet (or doesn't exist).`,
        )
        return
      }
      const outputName = value.output ?? "folder"
      if (outputName === "folder") {
        const config =
          commandConfigsByName[sourceStep.command]
        if (!config) {
          errors.push(
            `Param "${key}" links to step "${value.linkedTo}" but its command "${sourceStep.command}" is unknown.`,
          )
          return
        }
        resolved[key] = computeStepFolderOutput(
          sourceStep,
          config,
        )
        return
      }
      const named = sourceStep.outputs?.[outputName]
      if (named === undefined) {
        errors.push(
          `Param "${key}" links to step "${value.linkedTo}" output "${outputName}" but no such output was produced.`,
        )
        return
      }
      resolved[key] = named
      return
    }

    // Pass-through.
    resolved[key] = value
  })

  return { resolved, errors }
}
