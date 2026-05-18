import { availableParallelism } from "node:os"

// Worker 29 collapsed the two-process layout into a single front-door
// listening on PORT. WEB_PORT no longer exists.
export const API_PORT = Number(process.env.PORT ?? 3000)

export const MAX_THREADS =
  Number(process.env.MAX_THREADS) || availableParallelism()
