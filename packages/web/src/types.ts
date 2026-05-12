// Shared domain types — used across many components and not owned by
// any single feature. Feature-specific types live next to their feature:
//
//   - components/LookupModal/types.ts        (Lookup*, LookupState)
//   - components/ApiRunModal/types.ts        (RunStatus, ApiRunState)
//   - components/PromptModal/types.ts        (Prompt*, PromptData)
//   - components/FileExplorerModal/types.ts  (FileEntry, Sort*, FileExplorerState)
//   - jobs/types.ts                          (Job, JobStatus, ProgressSnapshot)
//
// Only add a type here if it is genuinely cross-cutting (5+ feature
// consumers). Otherwise colocate it.
//
// DirEntry is re-exported from the server because it is the shared API
// contract for "what /files returns" and is consumed by PathPicker +
// FileExplorerModal + FolderMultiSelectField.

import type { DirEntry } from "@media-tools/server/api-types"

export type { DirEntry }

export type EnumOption = {
  value: string | number | boolean
  label: string
}

export type CommandField = {
  name: string
  type: string
  label?: string
  description?: string
  required?: boolean
  default?: unknown
  options?: EnumOption[]
  companionNameField?: string
  sourceField?: string
  lookupType?: string
  placeholder?: string
  linkable?: boolean
  visibleWhen?: Record<string, unknown>
  min?: number
  max?: number
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
  isCollapsed: boolean
}

export type PathVariable = {
  id: string
  label: string
  value: string
}

export type Group = {
  kind: "group"
  id: string
  label: string
  isParallel: boolean
  isCollapsed: boolean
  steps: Step[]
}

export type SequenceItem = Step | Group
