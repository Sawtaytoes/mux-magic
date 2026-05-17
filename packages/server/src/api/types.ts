export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped"
  // Terminal status meaning "the sequence reached a planned early-exit
  // point and ran cleanly to that point." Distinct from `completed`
  // (work finished), `failed` (something went wrong), `cancelled` (a
  // human/system aborted it), and `skipped` (earlier failure cascaded
  // past this step). Set on the umbrella sequence job by a step like
  // `exitIfEmpty`, and cascaded to every later flat step that never
  // ran by design.
  | "exited"

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
  // Per-job thread-count claim registered with the task scheduler.
  // Derived from the sequence's threadCount Variable at job creation;
  // falls back to DEFAULT_THREAD_COUNT when not set. null for
  // top-level (non-sequence) jobs, which use only the global cap.
  threadCountClaim: number | null
}

// JSON-serialized projection of `Job` that the web client actually
// receives on /jobs/stream and /jobs/:id. JSON.stringify turns Date
// instances into ISO strings, so consumers reading these fields from
// the wire see `string | null`, not `Date | null`. Use this type on the
// client where you handle response payloads; use `Job` on the server
// where you handle in-memory state.
export type JobWire = Omit<
  Job,
  "startedAt" | "completedAt"
> & {
  startedAt: string | null
  completedAt: string | null
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
  // Optional per-option file paths for multi-file prompts (e.g. the
  // duplicate-detection picker emitted by nameSpecialFeaturesDvdCompareTmdb when two
  // or more files match the same target name). Each entry pairs an
  // option's `index` with the absolute path the option represents so
  // the Builder can render a ▶ Play button on each row. Independent of
  // `filePath`: `filePath` is for "preview the file the prompt is
  // about", `filePaths` is for "preview the file each option is".
  filePaths?: Array<{ index: number; path: string }>
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
  error?: string | null
}

// Terminal payload for the /jobs/:id/logs SSE stream. Sent once on
// completion / failure / cancellation. Has no `type` discriminator — the
// presence of `isDone: true` is the discriminator (matches the wire format
// emitted by logRoutes.ts).
export type JobLogDoneEvent = {
  isDone: true
  status: JobStatus
  results?: unknown[]
  outputs?: Record<string, unknown> | null
  error?: string | null
}

// Live log line on the /jobs/:id/logs SSE stream. No `type` field — the
// presence of `line` is the discriminator. Each line carries an SSE `id`
// equal to its index in `job.logs` so reconnects can dedup via
// lastEventId; the JSON payload itself is just { line }.
export type JobLogLineEvent = {
  line: string
}

// Full discriminated union of payloads that can arrive on /jobs/:id/logs.
// Note that the discriminator is split across three keys: `type` (for
// step/progress/prompt events), `line` (for log lines), and `done` (for
// the terminal frame). Consumers narrow by checking which key is present.
export type JobLogsEvent =
  | StepEvent
  | ProgressEvent
  | PromptEvent
  | JobLogLineEvent
  | JobLogDoneEvent

export type {
  DvdCompareRelease,
  DvdCompareResult,
  DvdCompareVariant,
} from "../tools/searchDvdCompare.js"

import type { z } from "@hono/zod-openapi"
import type * as schemas from "./schemas.js"
import type {
  directoryEntrySchema,
  fileExplorerEntrySchema,
} from "./schemas.js"

export type DirEntry = ReturnType<
  (typeof directoryEntrySchema)["parse"]
>
export type FileEntry = ReturnType<
  (typeof fileExplorerEntrySchema)["parse"]
>

// Response shapes for the API endpoints web calls. Derived from the same
// Zod schemas the server uses for validation so any server-side change is
// observed by web typecheck instead of slipping through inline `as` casts.
export type CreateJobResponse = z.infer<
  ReturnType<typeof schemas.createJobResponseSchema>
>
export type ListDirectoryEntriesResponse = z.infer<
  typeof schemas.listDirectoryEntriesResponseSchema
>
export type ListFilesResponse = z.infer<
  typeof schemas.listFilesResponseSchema
>
export type SearchMalResponse = z.infer<
  typeof schemas.searchMalResponseSchema
>
export type SearchAnidbResponse = z.infer<
  typeof schemas.searchAnidbResponseSchema
>
export type SearchTvdbResponse = z.infer<
  typeof schemas.searchTvdbResponseSchema
>
export type SearchMovieDbResponse = z.infer<
  typeof schemas.searchMovieDbResponseSchema
>
export type SearchDvdCompareResponse = z.infer<
  typeof schemas.searchDvdCompareResponseSchema
>
export type ListDvdCompareReleasesResponse = z.infer<
  typeof schemas.listDvdCompareReleasesResponseSchema
>
export type LookupMalRequest = z.infer<
  typeof schemas.lookupMalRequestSchema
>
export type LookupAnidbRequest = z.infer<
  typeof schemas.lookupAnidbRequestSchema
>
export type LookupTvdbRequest = z.infer<
  typeof schemas.lookupTvdbRequestSchema
>
export type LookupMovieDbRequest = z.infer<
  typeof schemas.lookupMovieDbRequestSchema
>
export type LookupDvdCompareRequest = z.infer<
  typeof schemas.lookupDvdCompareRequestSchema
>
export type LookupDvdCompareReleaseRequest = z.infer<
  typeof schemas.lookupDvdCompareReleaseRequestSchema
>
export type NameLookupResponse = z.infer<
  typeof schemas.nameLookupResponseSchema
>
export type LabelLookupResponse = z.infer<
  typeof schemas.labelLookupResponseSchema
>
export type DeleteModeResponse = z.infer<
  typeof schemas.deleteModeResponseSchema
>
export type DeleteFilesResponse = z.infer<
  typeof schemas.deleteFilesResponseSchema
>

// ─── Lookup-picker canonical types (consumed by web LookupModal) ─────────────
// The web's LookupModal needs a single union spanning all per-provider search
// results plus the picker's enum of provider keys. Defining these here keeps
// the type-vs-wire contract verifiable on the server; web imports as-is.

export const LOOKUP_TYPES = [
  "mal",
  "anidb",
  "tvdb",
  "tmdb",
  "dvdcompare",
] as const
export type LookupType = (typeof LOOKUP_TYPES)[number]

// Per-provider search-result item types. SearchDvdCompareResult is aliased to
// the existing DvdCompareResult (same shape, both schema-inferred and
// tool-emitted) so callers can use the consistent Search*Result naming.
export type SearchMalResult =
  SearchMalResponse["results"][number]
export type SearchAnidbResult =
  SearchAnidbResponse["results"][number]
export type SearchTvdbResult =
  SearchTvdbResponse["results"][number]
export type SearchMovieDbResult =
  SearchMovieDbResponse["results"][number]
export type SearchDvdCompareResult =
  SearchDvdCompareResponse["results"][number]

// Union of every per-provider search result. Discriminable structurally:
// each branch has a distinguishing required field (malId / aid / tvdbId /
// movieDbId / id+baseTitle for DVDCompare). Web picker code narrows by
// checking which key is present.
export type LookupSearchResult =
  | SearchMalResult
  | SearchAnidbResult
  | SearchTvdbResult
  | SearchMovieDbResult
  | SearchDvdCompareResult

// Release row from listDvdCompareReleases — shape lives on the tool, this
// alias keeps the picker-stage naming aligned with the other Lookup* types.
export type LookupRelease = z.infer<
  typeof schemas.dvdCompareReleaseSchema
>
