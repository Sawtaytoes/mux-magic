// Thin shim around `process.platform` and `process.cwd()` so callers can
// resolve them through a mockable module instead of reading the process
// global directly. Lets tests use `vi.mock("./currentEnvironment.js")`
// instead of mutating `process` — the mutation pattern is process-global
// state and pollutes across tests inside the same vitest worker.
export const getPlatform = (): NodeJS.Platform =>
  process.platform

export const getCwd = (): string => process.cwd()
