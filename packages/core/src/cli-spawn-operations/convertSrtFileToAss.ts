import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { concatMap, from, map } from "rxjs"
import { runFfmpeg } from "./runFfmpeg.js"

export const convertSrtFileToAss = ({
  inputFilePath,
  outputFilePath,
}: {
  inputFilePath: string
  outputFilePath: string
}) =>
  from(
    mkdir(dirname(outputFilePath), { recursive: true }),
  ).pipe(
    concatMap(() =>
      runFfmpeg({
        args: ["-c:s", "ass"],
        inputFilePaths: [inputFilePath],
        outputFilePath,
      }),
    ),
    map(() => outputFilePath),
  )
