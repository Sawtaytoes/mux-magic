import type { JobStatus } from "@mux-magic/server/api-types"

export type ActiveChild = {
  stepId: string
  jobId: string | null
}

type SequenceRunModalOpen = {
  mode: "open" | "background"
  jobId: string | null
  status: JobStatus
  logs: string[]
  activeChildren: ActiveChild[]
  source: "step" | "sequence"
}

export type SequenceRunModalState =
  | { mode: "closed" }
  | SequenceRunModalOpen

export type SequenceRunModalOpenState = SequenceRunModalOpen
