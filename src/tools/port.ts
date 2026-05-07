import { cpus } from "node:os"

export const PORT = Number(process.env.PORT ?? 3000)
export const CLI_SERVER_PORT = Number(process.env.CLI_SERVER_PORT ?? 3002)
export const MAX_THREADS = Number(process.env.MAX_THREADS) || cpus().length
