import { basename, dirname, extname, join } from "node:path"
import { map, type Observable } from "rxjs"

import { runMkvMerge } from "./runMkvMerge.js"

// Pass-through container remux: feeds the input directly to mkvmerge with
// no track-selection flags, so every track survives and only the container
// changes (e.g. .ts → .mkv). The output sits next to the input with the
// same basename and a .mkv extension. Caller is responsible for any
// pre-flight collision check on outputFilePath; mkvmerge will overwrite
// silently if asked.
export const remuxMkvMerge = ({
  inputFilePath,
}: {
  inputFilePath: string
}): Observable<{
  inputFilePath: string
  outputFilePath: string
}> => {
  const outputFilePath = join(
    dirname(inputFilePath),
    `${basename(inputFilePath, extname(inputFilePath))}.mkv`,
  )

  return runMkvMerge({
    args: [inputFilePath],
    outputFilePath,
  }).pipe(map(() => ({ inputFilePath, outputFilePath })))
}
