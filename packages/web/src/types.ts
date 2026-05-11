export type EnumOption = {
  value: string | number | boolean
  label: string
}

export type CommandField = {
  name: string
  type: string
  label?: string
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

export type DirEntry = {
  name: string
  isDirectory: boolean
}

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

export type PathVar = {
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

// ─── Wave E: Lookup Modal ─────────────────────────────────────────────────────

export type LookupType =
  | "mal"
  | "anidb"
  | "tvdb"
  | "tmdb"
  | "dvdcompare"
export type LookupStage = "search" | "variant" | "release"

export type LookupSearchResult = {
  malId?: number
  aid?: number
  tvdbId?: number
  movieDbId?: number
  name?: string
  title?: string
  year?: string
}

export type LookupVariant = {
  id: string
  variant: string
}

export type LookupGroup = {
  baseTitle: string
  year?: string
  variants: LookupVariant[]
}

export type LookupRelease = {
  hash: string | number
  label: string
}

export type LookupState = {
  lookupType: LookupType
  stepId: string
  fieldName: string
  stage: LookupStage
  searchTerm: string
  searchError: string | null
  results: LookupSearchResult[] | null
  formatFilter: string
  selectedGroup: LookupGroup | null
  selectedVariant: string | null
  selectedFid: string | null
  releases: LookupRelease[] | null
  releasesDebug: unknown
  releasesError: string | null
  loading: boolean
}

// ─── Wave E: Run Sequence / ApiRunModal ───────────────────────────────────────

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type ApiRunState = {
  jobId: string | null
  status: RunStatus
  logs: string[]
  childJobId: string | null
  childStepId: string | null
}

// ─── Wave E: Prompt Modal ─────────────────────────────────────────────────────

export type PromptOption = {
  index: number
  label: string
}

export type PromptFilePath = {
  index: number
  path: string
}

export type PromptData = {
  jobId: string
  promptId: string
  message: string
  filePath?: string
  filePaths?: PromptFilePath[]
  options: PromptOption[]
}

// ─── Wave E: File Explorer Modal ──────────────────────────────────────────────

export type FileEntry = {
  name: string
  isDirectory: boolean
  isFile: boolean
  size: number
  duration: string | null
  mtime: string | null
}

export type SortColumn =
  | "default"
  | "name"
  | "duration"
  | "size"
  | "mtime"
export type SortDirection = "asc" | "desc"

export type FileExplorerState = {
  path: string
  pickerOnSelect: ((selectedPath: string) => void) | null
}

// ─── Wave F: Jobs page ────────────────────────────────────────────────────────

export type ProgressSnapshot = {
  ratio?: number
  filesDone?: number
  filesTotal?: number
  bytesPerSecond?: number
  bytesRemaining?: number
  currentFiles?: Array<{ path: string; ratio?: number }>
}

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped"

export type Job = {
  id: string
  commandName?: string
  command?: string
  status: JobStatus
  startedAt?: string
  completedAt?: string
  parentJobId?: string
  stepId?: string
  params?: Record<string, unknown>
  error?: string
  results?: unknown[]
}
