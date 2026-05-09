import { cpus } from "node:os"

export const PORT = Number(process.env.PORT ?? 3000)
export const MAX_THREADS = Number(process.env.MAX_THREADS) || cpus().length
