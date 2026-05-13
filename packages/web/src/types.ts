// Sequence-domain types — used across every step / group / path /
// drag / run code path. These are THE shared model; nothing here is
// owned by a single feature.
//
// Feature-specific types and the command-schema family live next to
// their owner:
//
//   - commands/types.ts                      (EnumOption, CommandField, CommandDefinition, Commands)
//   - components/PathPicker/types.ts         (DirEntry)
//   - components/LookupModal/types.ts        (Lookup*, LookupState)
//   - components/ApiRunModal/types.ts        (ActiveChild, ApiRunState — status uses server JobStatus)
//   - components/PromptModal/types.ts        (Prompt*, PromptData)
//   - components/FileExplorerModal/types.ts  (FileEntry, Sort*, FileExplorerState)
//   - jobs/types.ts                          (Job, JobStatus, ProgressSnapshot)
//
// Only add a type here if it is genuinely cross-cutting across the
// sequence-builder data model. Otherwise colocate it with the feature
// that owns it.

export type StepLink =
  | string // path variable ID, e.g. "basePath"
  | { linkedTo: string; output: string } // step output reference

export type Step = {
  id: string
  alias: string
  command: string
  params: Record<string, unknown>
  links: Record<string, StepLink>
  status: string | null
  jobId?: string | null
  error: string | null
  hasResults?: boolean | null
  isCollapsed: boolean
}

// VariableType is a discriminator union. Workers 11 and 35 register additional
// types ("threadCount", "dvdCompareId") — this union grows as they land.
export type VariableType = "path"

export type Variable<
  T extends VariableType = VariableType,
> = {
  id: string
  label: string
  value: string
  type: T
}

// Back-compat alias: PathVariable is structurally equivalent to Variable<"path">.
// Callers using PathVariable continue to compile; migrate them to Variable over time.
export type PathVariable = Variable<"path">

export type Group = {
  kind: "group"
  id: string
  label: string
  isParallel: boolean
  isCollapsed: boolean
  steps: Step[]
}

export type SequenceItem = Step | Group
