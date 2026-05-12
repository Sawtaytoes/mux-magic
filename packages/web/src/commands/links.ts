// ─── Link-resolution helpers ──────────────────────────────────────────────────
// Ported from sequence-state.js. All legacy functions read from module-level
// globals (paths, steps); the TS versions take them as explicit parameters so
// they are pure functions that React components can call from atoms / hooks.

import type { Commands } from "../commands/types"
import type { PathVariable, Step } from "../types"

// Returns the canonical "source" field name for a command — the field whose
// linked value represents the input folder the step reads from.
export const mainSrcField = (
  commandName: string,
  commands: Commands,
): string | null => {
  const commandDefinition = commands[commandName]
  if (!commandDefinition) return null

  const preferredFieldName = [
    "sourcePath",
    "sourceFilesPath",
    "mediaFilesPath",
  ].find((fieldName) =>
    commandDefinition.fields.some(
      (field) => field.name === fieldName,
    ),
  )
  if (preferredFieldName) return preferredFieldName

  const pathField = commandDefinition.fields.find(
    (field) => field.type === "path",
  )
  return pathField ? pathField.name : null
}

// Computes the output folder path of a step — used when another step links to
// this step's output via an object link `{ linkedTo, output: "folder" }`.
export const stepOutput = (
  step: Step,
  paths: PathVariable[],
  commands: Commands,
  findStep: (id: string) => Step | undefined,
): string => {
  if (!step.command) return ""
  const commandDefinition = commands[step.command]
  if (!commandDefinition) return ""

  const mainSourceFieldName = mainSrcField(
    step.command,
    commands,
  )
  const rawSource = mainSourceFieldName
    ? (getLinkedValue(
        step,
        mainSourceFieldName,
        paths,
        commands,
        findStep,
      ) ??
      (step.params[mainSourceFieldName] as
        | string
        | undefined) ??
      "")
    : ""
  const source = rawSource.replace(/[\\/]$/, "")

  if (
    commandDefinition.outputComputation === "parentOfSource"
  ) {
    return source ? source.replace(/[\\/][^\\/]*$/, "") : ""
  }
  if (commandDefinition.outputFolderName) {
    const separator = source.includes("\\") ? "\\" : "/"
    return source
      ? source +
          separator +
          commandDefinition.outputFolderName
      : commandDefinition.outputFolderName
  }

  const hasField = (fieldName: string) =>
    commandDefinition.fields.some(
      (field) => field.name === fieldName,
    )

  if (hasField("destinationPath")) {
    const destination =
      getLinkedValue(
        step,
        "destinationPath",
        paths,
        commands,
        findStep,
      ) ??
      (step.params.destinationPath as string | undefined)
    if (destination) return destination
  }
  if (hasField("destinationFilesPath")) {
    const destination =
      getLinkedValue(
        step,
        "destinationFilesPath",
        paths,
        commands,
        findStep,
      ) ??
      (step.params.destinationFilesPath as
        | string
        | undefined)
    if (destination) return destination
  }

  return source
}

// Resolves the display value for a linked field:
//   - string link  → look up the path variable and return its value
//   - object link  → compute the source step's output folder path
export const getLinkedValue = (
  step: Step,
  fieldName: string,
  paths: PathVariable[],
  commands: Commands,
  findStep: (id: string) => Step | undefined,
): string | null => {
  const link = step.links?.[fieldName]
  if (!link) return null

  if (typeof link === "string") {
    const pathVariable = paths.find(
      (pathVariableEntry) => pathVariableEntry.id === link,
    )
    return pathVariable?.value || null
  }

  if (
    link &&
    typeof link === "object" &&
    typeof link.linkedTo === "string"
  ) {
    const sourceStep = findStep(link.linkedTo)
    if (!sourceStep) return null

    if (link.output === "folder" || !link.output) {
      return stepOutput(
        sourceStep,
        paths,
        commands,
        findStep,
      )
    }
    return (
      (
        sourceStep as Step & {
          outputs?: Record<string, string>
        }
      ).outputs?.[link.output] ?? null
    )
  }

  return null
}
