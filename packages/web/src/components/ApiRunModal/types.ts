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

export type ActiveChild = {
  stepId: string
  jobId: string | null
}

export type ApiRunState = {
  jobId: string | null
  status: RunStatus
  logs: string[]
  activeChildren: ActiveChild[]
  source: "step" | "sequence"
}
