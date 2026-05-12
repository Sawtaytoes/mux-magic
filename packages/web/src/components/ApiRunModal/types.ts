// Types owned by ApiRunModal — the modal that opens when a step,
// group, or full sequence is run via the API.
//
// `source: "step"` vs `"sequence"` is the discriminant the modal uses
// to decide which title to render ("Run Step" vs "Run Sequence").
//
// `status` reuses the server-canonical `JobStatus` so a new status added
// server-side (e.g. "skipped" from sequence step short-circuiting) fails
// web typecheck rather than silently falling into an undefined CSS class.

import type { JobStatus } from "@media-tools/server/api-types"

export type ActiveChild = {
  stepId: string
  jobId: string | null
}

export type ApiRunState = {
  jobId: string | null
  status: JobStatus
  logs: string[]
  activeChildren: ActiveChild[]
  source: "step" | "sequence"
}
