import { mkdir } from "node:fs/promises"
import { defer } from "rxjs"

export const makeDirectory = (directoryPath: string) =>
  defer(() => mkdir(directoryPath, { recursive: true }))
