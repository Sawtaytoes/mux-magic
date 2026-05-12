import type { Job } from "../types"

// Test/story helper for constructing a Job that satisfies the canonical
// server-derived `JobWire` shape. Provide only the fields a test cares
// about; everything else gets a benign default. Centralizing this means
// when the server adds a new required field, every fixture continues to
// compile (the default is filled in here) and only places that care
// about the new field need touching.
export const makeFakeJob = (
  overrides: Partial<Job> &
    Pick<Job, "id" | "commandName" | "status">,
): Job => ({
  completedAt: null,
  error: null,
  logs: [],
  outputFolderName: null,
  outputs: null,
  params: null,
  parentJobId: null,
  results: [],
  startedAt: null,
  stepId: null,
  ...overrides,
})
