// eslint-disable-next-line no-restricted-syntax -- intentional: fixture for webtypes-eslint-guard rule
interface CreateJobResponse {
  jobId: string
}

// eslint-disable-next-line no-restricted-syntax -- intentional: fixture for webtypes-eslint-guard rule
type RunStatus = "pending" | "running" | "complete"

export type { CreateJobResponse, RunStatus }
