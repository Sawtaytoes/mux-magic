// Schema-driven command-UI contract.
//
// `Commands` is the server-provided map of command name → field schema
// that the builder uses to render the per-step settings. Every field
// component (BooleanField, EnumField, PathField, …) reads its layout
// hints from a `CommandField`; buildParams unwraps a `CommandDefinition`
// to serialize a step back to YAML.
//
// Lives in commands/ because that directory already owns the related
// logic (buildParams, fieldVisibility, links, lookupLinks). Keeping the
// types here lets the schema and the helpers move together.

export type EnumOption = {
  value: string | number | boolean
  label: string
}

export type CommandField = {
  name: string
  type: string
  label?: string
  description?: string
  isRequired?: boolean
  default?: unknown
  options?: EnumOption[]
  companionNameField?: string
  sourceField?: string
  lookupType?: string
  placeholder?: string
  isLinkable?: boolean
  visibleWhen?: Record<string, unknown>
  min?: number
  max?: number
  hasIncrementButtons?: boolean
  // When set, the link picker only shows step rows whose named output
  // appears in this list, AND hides path-variable rows entirely. Use
  // this on fields whose runtime type is incompatible with the default
  // `folder` (single-path) output and with path variables — e.g.
  // `deleteCopiedOriginals.pathsToDelete`, which is `string[]` and only
  // makes sense when wired to `copyFiles.copiedSourcePaths`.
  acceptedOutputs?: ReadonlyArray<string>
}

export type CommandDefinition = {
  tag?: string
  summary?: string
  note?: string
  fields: CommandField[]
  persistedKeys?: string[]
  outputFolderName?: string | null
  outputComputation?: string
  outputs?: ReadonlyArray<{ name: string; label?: string }>
  groups?: ReadonlyArray<{
    fields: ReadonlyArray<string>
    layout: string
  }>
}

export type Commands = Record<string, CommandDefinition>
