// Types for the jobs subsystem — owned by jobs/ because they are
// the shared domain model for everything job-related (cards, SSE
// streams, progress bars, the Jobs page).
//
// JobStatus is defined server-side (shared API contract); Job and
// ProgressSnapshot are client-side shapes built on top of it.

import type { JobStatus } from "@media-tools/server/api-types"

export type { JobStatus }

export type ProgressSnapshot = {
  ratio?: number
  filesDone?: number
  filesTotal?: number
  bytesPerSecond?: number
  bytesRemaining?: number
  currentFiles?: Array<{ path: string; ratio?: number }>
}

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
