// Types for the jobs subsystem â€” owned by jobs/ because they are
// the shared domain model for everything job-related (cards, SSE
// streams, progress bars, the Jobs page).
//
// `Job` and `JobStatus` are the canonical server contract; they live in
// @mux-magic/server/api-types and are re-exported here so consumers in
// jobs/, components/, and state/ keep their existing import paths while
// any server-side change to the shape fails web typecheck.
//
// `ProgressSnapshot` is the MERGED shape â€” server's ProgressEvent (ratio,
// filesDone, filesTotal, currentFiles) plus the client-computed
// bytesPerSecond and bytesRemaining derived in mergeProgress.ts. It is
// not a 1:1 mirror of any server type; it is the in-UI rollup the
// progress bar renders.

// `Job` on the web is the JSON-projected wire shape (ISO-string dates),
// which is exactly what /jobs/stream + /jobs/:id emit after
// JSON.stringify. The server's in-memory `Job` (Date | null) becomes
// `JobWire` (string | null) on the wire â€” we re-alias here so existing
// `import type { Job }` call-sites continue to work without churn.
export type {
  JobStatus,
  JobWire as Job,
} from "@mux-magic/server/api-types"

export type ProgressSnapshot = {
  ratio?: number
  filesDone?: number
  filesTotal?: number
  bytesPerSecond?: number
  bytesRemaining?: number
  currentFiles?: Array<{ path: string; ratio?: number }>
}
