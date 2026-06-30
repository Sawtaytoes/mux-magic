import { readdir, stat } from "node:fs/promises"
import { basename, extname, join } from "node:path"
import {
  logInfo,
  makeDirectory,
  renameFileOrFolder,
} from "@mux-magic/tools"
import {
  catchError,
  concatMap,
  defer,
  EMPTY,
  from,
  ignoreElements,
  map,
  type Observable,
  of,
  tap,
  toArray,
} from "rxjs"
import { getFileDuration } from "../tools/getFileDuration.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import type { UnrenamedFile } from "./nameSpecialFeaturesDvdCompareTmdb.buildUnnamedFileCandidates.js"

// Worker 25: the filesystem is the cache.
//
// After NSF's rename pass completes, leftover unrenamed files auto-
// move into `<sourcePath>/UNNAMED-FEATURES/` and files dropped from
// the duplicate-detection prompt auto-move into
// `<sourcePath>/DUPLICATES/`. Bucket folders are created lazily — a
// fully-matched run leaves no buckets behind. The Smart Match modal
// then reads from `UNNAMED-FEATURES/` and Apply moves the file back
// to `sourcePath` with the new name in one operation; the user can
// also recover by hand by browsing the folder.
//
// Same-volume `fs.rename` always applies because the bucket is a
// direct child of the file's parent — never crosses volumes.
export const UNNAMED_FEATURES_BUCKET = "UNNAMED-FEATURES"
export const DUPLICATES_BUCKET = "DUPLICATES"

const BUCKET_NAMES = new Set([
  UNNAMED_FEATURES_BUCKET,
  DUPLICATES_BUCKET,
])

export const isBucketFolderName = (
  folderName: string,
): boolean => BUCKET_NAMES.has(folderName)

export type BucketMove = {
  oldPath: string
  newPath: string
}

// Move a batch of files into `<sourcePath>/<bucketName>/`, creating
// the bucket folder lazily on the first move (so a fully-matched run
// never produces an empty bucket on disk). Skips silently when
// `filePaths` is empty.
//
// Returns each successful move as a {oldPath, newPath} event so the
// orchestrator can log them through the existing pipeline.
// Defense-in-depth guard for re-runs against an already-bucketed
// folder. `getFilesAtDepth({ depth: 0 })` is files-only and won't
// recurse into bucket folders today, but logging the bucket presence
// explicitly makes the intent visible AND survives future refactors
// to the file enumeration. Returns a silent observable that taps a
// one-line log per bucket folder it finds.
//
// The count is files-at-top-level inside each bucket — children of a
// bucket are never recursed into.
export const logBucketFolderCountsIfPresent = (
  sourcePath: string,
): Observable<never> =>
  defer(async () => {
    const entries = await readdir(sourcePath).catch(
      () => [] as string[],
    )
    const bucketEntries = entries.filter(isBucketFolderName)
    await Promise.all(
      bucketEntries.map(async (bucketName) => {
        const bucketPath = join(sourcePath, bucketName)
        const stats = await stat(bucketPath).catch(
          () => null,
        )
        if (!stats?.isDirectory()) {
          return
        }
        const inner = await readdir(bucketPath).catch(
          () => [] as string[],
        )
        logInfo(
          "BUCKET FOLDER PRESENT",
          `${bucketName}/ already exists with ${inner.length} file${inner.length === 1 ? "" : "s"} — read back into Smart Match.`,
        )
      }),
    )
  }).pipe(ignoreElements())

// Worker 25's bucket read-back (regression fix — see
// docs/audits/nsf-unnamed-rerun-regression.md). On a re-run, the top-level
// source enumeration (`getFilesAtDepth({ depth: 0 })`) never recurses into
// `UNNAMED-FEATURES/`, so files a prior run left there used to vanish from
// the summary and the Smart Match modal never reopened. This reads those
// files back — measuring each one's duration so the candidate ranker has
// the same signal it had on the first pass — and returns them as
// `UnrenamedFile`s the orchestrator folds into the summary. Surface-only:
// these files are NOT renamed or re-bucketed here; the Smart Match modal's
// Apply moves them back to `sourcePath` with the user-picked name.
//
// Emits a single array (possibly empty when the bucket is absent/empty).
// A per-file mediainfo failure degrades to `durationSeconds: null` rather
// than dropping the file — the user can still rename it by hand.
export const readBucketUnrenamedFiles = ({
  sourcePath,
  bucketName,
}: {
  sourcePath: string
  bucketName: string
}): Observable<UnrenamedFile[]> =>
  defer(async () => {
    const bucketPath = join(sourcePath, bucketName)
    const entries = await readdir(bucketPath).catch(
      () => [] as string[],
    )
    return { bucketPath, entries }
  }).pipe(
    concatMap(({ bucketPath, entries }) =>
      from(entries).pipe(
        concatMap((entry) => {
          const fullPath = join(bucketPath, entry)
          return defer(() =>
            stat(fullPath).then((stats) => stats.isFile()),
          ).pipe(
            catchError(() => of(false)),
            concatMap((isFile) =>
              isFile
                ? getMediaInfo(fullPath).pipe(
                    concatMap((mediaInfo) =>
                      getFileDuration({ mediaInfo }),
                    ),
                    catchError(() => of(null)),
                    map(
                      (durationSeconds): UnrenamedFile => ({
                        filename: basename(
                          entry,
                          extname(entry),
                        ),
                        extension: extname(entry),
                        durationSeconds,
                      }),
                    ),
                  )
                : EMPTY,
            ),
          )
        }),
        toArray(),
      ),
    ),
  )

export const moveFilesToBucket = ({
  sourcePath,
  bucketName,
  filePaths,
}: {
  sourcePath: string
  bucketName: string
  filePaths: string[]
}): Observable<BucketMove> => {
  if (filePaths.length === 0) {
    return EMPTY
  }
  const bucketPath = join(sourcePath, bucketName)
  return makeDirectory(bucketPath).pipe(
    concatMap(() =>
      from(filePaths).pipe(
        concatMap((oldPath) => {
          const newPath = join(
            bucketPath,
            basename(oldPath),
          )
          return renameFileOrFolder({
            oldPath,
            newPath,
          }).pipe(
            map((): BucketMove => ({ oldPath, newPath })),
            tap((move) =>
              logInfo(
                "MOVED TO BUCKET",
                `${basename(move.oldPath)} → ${bucketName}/`,
              ),
            ),
          )
        }),
      ),
    ),
  )
}
