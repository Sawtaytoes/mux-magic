import { availableParallelism } from "node:os"

export const resolveMaxThreads = (): number =>
  Number(process.env.MAX_THREADS) || availableParallelism()

export const resolveDefaultThreadCount = (): number => {
  const raw = Number(process.env.DEFAULT_THREAD_COUNT ?? 2)
  if (raw <= 0) return resolveMaxThreads()
  return Math.min(raw, resolveMaxThreads())
}
