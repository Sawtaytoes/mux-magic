// Types owned by ApiRunModal — the modal that opens when a step,
// group, or full sequence is run via the API.
//
// `source: "step"` vs `"sequence"` is the discriminant the modal uses
// to decide which title to render ("Run Step" vs "Run Sequence").

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
  source: "step" | "sequence"
}
