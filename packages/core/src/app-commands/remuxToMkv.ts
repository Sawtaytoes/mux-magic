import { stat, unlink } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import {
  getFilesAtDepth,
  logAndSwallowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  filter,
  from,
  map,
  type Observable,
  tap,
} from "rxjs"
import { remuxMkvMerge } from "../cli-spawn-operations/remuxMkvMerge.js"
import { withFileProgress } from "../tools/progressEmitter.js"

// Pass-through container remux for every file in `sourcePath` whose
// extension matches `extensions`. Each match is fed to mkvmerge with no
// track filtering, producing a sibling .mkv. When isSourceDeletedOnSuccess
// is true, the original is removed only after the per-file remux exits 0.
//
// Refuses to clobber a pre-existing same-named .mkv: bails on that file
// (the rest of the directory still processes) so a previous run's output
// can't be silently overwritten.
export const remuxToMkv = ({
  extensions,
  isRecursive,
  isSourceDeletedOnSuccess,
  recursiveDepth,
  sourcePath,
}: {
  extensions: string[]
  isRecursive: boolean
  isSourceDeletedOnSuccess: boolean
  recursiveDepth?: number
  sourcePath: string
}): Observable<string> => {
  const normalizedExtensions = extensions
    .map((extension) =>
      extension.toLowerCase().replace(/^\./u, ""),
    )
    .filter(Boolean)

  return getFilesAtDepth({
    depth: isRecursive ? recursiveDepth || 1 : 0,
    sourcePath,
  }).pipe(
    filter((fileInfo) => {
      const fileExtension = extname(fileInfo.fullPath)
        .toLowerCase()
        .replace(/^\./u, "")
      return normalizedExtensions.includes(fileExtension)
    }),
    withFileProgress((fileInfo) => {
      const outputFilePath = join(
        dirname(fileInfo.fullPath),
        `${basename(fileInfo.fullPath, extname(fileInfo.fullPath))}.mkv`,
      )

      return defer(() =>
        stat(outputFilePath).then(
          () => {
            throw new Error(
              `Refusing to remux ${fileInfo.fullPath}: ${outputFilePath} already exists. Remove it and re-run.`,
            )
          },
          (error) => {
            if (
              (error as NodeJS.ErrnoException).code !==
              "ENOENT"
            ) {
              throw error
            }
          },
        ),
      ).pipe(
        concatMap(() =>
          remuxMkvMerge({
            inputFilePath: fileInfo.fullPath,
          }),
        ),
        concatMap(
          ({
            inputFilePath,
            outputFilePath: remuxedFilePath,
          }) => {
            if (!isSourceDeletedOnSuccess) {
              return from([remuxedFilePath])
            }
            return defer(() => unlink(inputFilePath)).pipe(
              tap(() => {
                logInfo("DELETED SOURCE", inputFilePath)
              }),
              map(() => remuxedFilePath),
            )
          },
        ),
        // Per-file inner pipe: log + swallow so a single bad file (e.g. an
        // existing same-named .mkv collision) is skipped while the outer
        // concatMap continues with the rest of the directory. NOT a
        // terminal handler — the OUTER observable has no catch, so a
        // failure outside this concatMap (e.g. getFiles itself ENOENT)
        // still propagates to the runner.
        logAndSwallowPipelineError(remuxToMkv),
      )
    }),
  )
}
