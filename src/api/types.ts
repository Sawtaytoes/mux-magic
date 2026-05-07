export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "skipped"

export type Job = {
  commandName: string
  completedAt: Date | null
  error: string | null
  id: string
  logs: string[]
  outputFolderName: string | null
  // Named runtime outputs, populated when the job completes via the
  // command's `extractOutputs` config. Distinct from `outputFolderName`
  // (static metadata declared per command) and from `results` (the raw
  // emission stream). null while the job is in flight or when the
  // command does not declare any outputs.
  outputs: Record<string, unknown> | null
  params: unknown
  // Set on jobs created by sequenceRunner — links each step's job back
  // to the umbrella sequence job. null for top-level jobs (single-command
  // /commands/<name> calls and umbrella /sequences/run jobs themselves).
  // The Jobs UI groups by this on the client.
  parentJobId: string | null
  results: unknown[]
  startedAt: Date | null
  status: JobStatus
  // Sequence step identifier (the SequenceStep's `id` field, either
  // user-supplied or auto-assigned `step1`, `step2`, …). Only set for
  // child jobs spawned by the sequence runner; null for top-level jobs.
  // The Jobs UI shows this in the per-step row so the user can match a
  // child job to the corresponding step in the Sequence Builder.
  stepId: string | null
}

export type PromptOption = {
  index: number
  label: string
}

export type PromptEvent = {
  message: string
  options: PromptOption[]
  promptId: string
  type: "prompt"
  // Optional absolute file path that this prompt is "about" — when set,
  // the Builder's prompt modal renders a ▶ Play button that streams the
  // file via /files/stream and opens the existing video sub-modal so the
  // user can preview before picking. Null/undefined for prompts that
  // aren't tied to a specific file (e.g. global search-results prompts).
  filePath?: string
}

// Job-progress payload pushed onto the per-job SSE subject by
// `createProgressEmitter`. Rides the same channel as PromptEvent and
// reaches the Jobs UI as one of the JSON shapes the client branches on.
//
// `ratio` is a 0..1 overall job ratio (null if the emitter is running
// in indeterminate mode — e.g. before an upfront stat() resolves).
// `filesDone` / `filesTotal` carry the per-file rollup for any iterator
// that walks N files. `currentFiles` is the snapshot of files
// currently in flight (one entry per active tracker) — multiple
// entries when per-file Tasks run in parallel. Empty / omitted when no
// file is actively being processed.
export type ProgressEvent = {
  type: "progress"
  ratio: number | null
  filesDone?: number
  filesTotal?: number
  currentFiles?: Array<{
    path: string
    ratio: number | null
  }>
}

// Sequence-runner step boundary, pushed onto the UMBRELLA job's per-job
// SSE subject (not the child's). Fires once per step transition: a
// `step-started` event when the runner picks up an inner step and is
// about to subscribe its observable, and a `step-finished` event with
// the terminal status the moment the outcome is decided. Carries the
// child's job id so a UI subscribed to the umbrella stream can open a
// per-child SSE for ProgressEvents (which fire on the CHILD subject,
// not the umbrella's) without parsing the human-facing log text.
export type StepEvent = {
  type: "step-started" | "step-finished"
  childJobId: string
  stepId: string | null
  status: JobStatus
}
