import { mkdir } from "node:fs/promises"
import { defer, map } from "rxjs"

export const makeDirectory = (directoryPath: string) =>
  defer(() =>
    mkdir(directoryPath, { recursive: true }),
  ).pipe(map(() => directoryPath))
