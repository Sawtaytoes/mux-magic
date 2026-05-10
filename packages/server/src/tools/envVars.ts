import { cpus } from "node:os"

export const API_PORT = Number(process.env.PORT ?? 3000)
export const WEB_PORT = Number(process.env.WEB_PORT ?? 4173)

export const MAX_THREADS =
  Number(process.env.MAX_THREADS) || cpus().length
