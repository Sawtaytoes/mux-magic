import { basename, dirname } from "node:path"

import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  catchError,
  concatMap,
  defer,
  filter,
  from,
  map,
  of,
  tap,
  toArray,
} from "rxjs"

import {
  type ResolvedCoverArt,
  resolveCoverArtImage,
} from "../music/artwork/resolveCoverArtImage.js"
import { saveCoverArtFile } from "../music/artwork/saveCoverArtFile.js"
import { writeEmbeddedCoverArt } from "../music/artwork/writeEmbeddedCoverArt.js"
import { readAudioTags } from "../music/tags/readAudioTags.js"
import type { CachedFetch } from "../tools/musicBrainzApi.js"
import { rateLimitedMusicBrainzFetch } from "../tools/musicBrainzApi.js"
import { itunesCachedFetch as defaultItunesCachedFetch } from "../tools/musicProviderFetchers.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import { isAudioFilePath } from "./scanAudioFiles.js"

// The cover-art half of the Picard replacement, and the gap that let a
// verified ingest land in the library with a blank album. Mux Magic could
// already READ `hasEmbeddedCoverArt` and could already FIND a front cover on
// the Cover Art Archive; it had no way to write one.
//
// One album folder, one run. The image is resolved once and then applied to
// every file, so thirteen tracks share one download and one identical
// picture — which is also what makes "already written" a cheap byte compare
// on the second run.
//
// `isDryRun` reports what would change and writes nothing.

export type ApplyCoverArtWrittenRecord = {
  filePath: string
  filename: string
  isDryRun: boolean
  // False when the file got the cover art but kept the write's timestamp,
  // because the process does not own the file. The write still counts.
  isTimestampRestored: boolean
  kind: "written"
}

export type ApplyCoverArtUnchangedRecord = {
  filePath: string
  filename: string
  kind: "unchanged"
}

export type ApplyCoverArtFailedRecord = {
  filePath: string
  filename: string
  kind: "failed"
  reason: string
}

export type ApplyCoverArtRecord =
  | ApplyCoverArtWrittenRecord
  | ApplyCoverArtUnchangedRecord
  | ApplyCoverArtFailedRecord

export type ApplyCoverArtResult = {
  coverArtFilePath: string | null
  imageByteCount: number | null
  imageUrl: string | null
  isCoverArtFileWritten: boolean
  mimeType: string | null
  records: ApplyCoverArtRecord[]
  source: ResolvedCoverArt["source"] | null
}

export type ApplyCoverArtProps = {
  cachedFetch?: CachedFetch
  imageUrl?: string
  itunesCachedFetch?: CachedFetch
  isDryRun?: boolean
  isEmbedded?: boolean
  isSavedBesideFiles?: boolean
  releaseGroupId?: string
  releaseId?: string
  sourcePath: string
}

// The MusicBrainz ids already in the files. A folder tagged by Picard or by
// this app's own tag table carries them, and reading them here is what makes
// the command work with no arguments beyond the folder.
// The album title and artist come from the same read, because the iTunes
// provider searches on them. Album artist is preferred over track artist:
// on a compilation the track artist differs per file and would never match
// the album Apple lists.
const readAlbumIdentityFromFiles = (filePaths: string[]) =>
  Promise.all(
    filePaths
      .slice(0, 1)
      .map((filePath) => readAudioTags(filePath)),
  )
    .then(([firstFile]) => ({
      albumTitle: firstFile?.tags.album,
      artistName:
        firstFile?.tags.albumArtist ??
        firstFile?.tags.artist,
      releaseGroupId:
        firstFile?.tags.musicBrainzReleaseGroupId,
      releaseId: firstFile?.tags.musicBrainzReleaseId,
    }))
    .catch(() => ({
      albumTitle: undefined,
      artistName: undefined,
      releaseGroupId: undefined,
      releaseId: undefined,
    }))

// `defer`, not a bare `from(promise)`. The operator above this one can hold
// a projected observable in a queue before it subscribes, and an eagerly
// started promise would reject into nobody — an unhandled rejection that
// takes the whole process down instead of becoming a `failed` row. Deferring
// makes the write start when the row is actually pulled.
const embedInOneFile = ({
  filePath,
  image,
  isDryRun,
}: {
  filePath: string
  image: ResolvedCoverArt["image"]
  isDryRun: boolean
}) =>
  defer(() =>
    writeEmbeddedCoverArt({ filePath, image, isDryRun }),
  ).pipe(
    map(
      ({
        isChanged,
        isTimestampRestored,
      }): ApplyCoverArtRecord =>
        isChanged
          ? {
              filePath,
              filename: basename(filePath),
              isDryRun,
              isTimestampRestored,
              kind: "written",
            }
          : {
              filePath,
              filename: basename(filePath),
              kind: "unchanged",
            },
    ),
    // One unwritable file does not fail the album. The row carries the
    // reason so the results panel can show which file and why.
    catchError((error: unknown) =>
      of<ApplyCoverArtRecord>({
        filePath,
        filename: basename(filePath),
        kind: "failed",
        reason:
          error instanceof Error
            ? error.message
            : String(error),
      }),
    ),
  )

const logCoverArtSummary = ({
  isDryRun,
  resolvedCoverArt,
  records,
}: {
  isDryRun: boolean
  resolvedCoverArt: ResolvedCoverArt | null
  records: ApplyCoverArtRecord[]
}) =>
  logInfo(
    "applyCoverArt",
    resolvedCoverArt === null
      ? "No cover art was found for this folder."
      : `${
          records.filter(
            (record) => record.kind === "written",
          ).length
        } of ${records.length} files ${
          isDryRun ? "would get" : "got"
        } the ${resolvedCoverArt.source} cover art.`,
  )

const applyResolvedCoverArt = ({
  filePaths,
  folderPath,
  isDryRun,
  isEmbedded,
  isSavedBesideFiles,
  resolvedCoverArt,
}: {
  filePaths: string[]
  folderPath: string
  isDryRun: boolean
  isEmbedded: boolean
  isSavedBesideFiles: boolean
  resolvedCoverArt: ResolvedCoverArt
}) =>
  from(
    isSavedBesideFiles
      ? saveCoverArtFile({
          folderPath,
          image: resolvedCoverArt.image,
          isDryRun,
        })
      : Promise.resolve({
          coverArtFilePath: null,
          isWritten: false,
        }),
  ).pipe(
    concatMap((savedCoverArtFile) =>
      from(filePaths).pipe(
        withFileProgress((filePath) =>
          isEmbedded
            ? embedInOneFile({
                filePath,
                image: resolvedCoverArt.image,
                isDryRun,
              })
            : of<ApplyCoverArtRecord>({
                filePath,
                filename: basename(filePath),
                kind: "unchanged",
              }),
        ),
        toArray(),
        tap((records) => {
          logCoverArtSummary({
            isDryRun,
            records,
            resolvedCoverArt,
          })
        }),
        map(
          (records): ApplyCoverArtResult => ({
            coverArtFilePath:
              savedCoverArtFile.coverArtFilePath,
            imageByteCount:
              resolvedCoverArt.image.bytes.length,
            imageUrl: resolvedCoverArt.imageUrl,
            isCoverArtFileWritten:
              savedCoverArtFile.isWritten,
            mimeType: resolvedCoverArt.image.mimeType,
            records,
            source: resolvedCoverArt.source,
          }),
        ),
      ),
    ),
  )

export const applyCoverArt = ({
  cachedFetch = rateLimitedMusicBrainzFetch,
  imageUrl,
  isDryRun = false,
  itunesCachedFetch = defaultItunesCachedFetch,
  isEmbedded = true,
  isSavedBesideFiles = true,
  releaseGroupId,
  releaseId,
  sourcePath,
}: ApplyCoverArtProps) =>
  getFilesAtDepth({ depth: 0, sourcePath }).pipe(
    filter((fileInfo) =>
      isAudioFilePath(fileInfo.fullPath),
    ),
    map((fileInfo) => fileInfo.fullPath),
    toArray(),
    concatMap((filePaths) =>
      filePaths.length === 0
        ? of<ApplyCoverArtResult>({
            coverArtFilePath: null,
            imageByteCount: null,
            imageUrl: null,
            isCoverArtFileWritten: false,
            mimeType: null,
            records: [],
            source: null,
          })
        : from(
            readAlbumIdentityFromFiles(filePaths).then(
              (albumIdentity) =>
                resolveCoverArtImage({
                  albumTitle: albumIdentity.albumTitle,
                  artistName: albumIdentity.artistName,
                  cachedFetch,
                  folderPath: dirname(filePaths[0] ?? ""),
                  imageUrl,
                  itunesCachedFetch,
                  releaseGroupId:
                    releaseGroupId ??
                    albumIdentity.releaseGroupId,
                  releaseId:
                    releaseId ?? albumIdentity.releaseId,
                }),
            ),
          ).pipe(
            concatMap((resolvedCoverArt) =>
              resolvedCoverArt === null
                ? of<ApplyCoverArtResult>({
                    coverArtFilePath: null,
                    imageByteCount: null,
                    imageUrl: null,
                    isCoverArtFileWritten: false,
                    mimeType: null,
                    records: [],
                    source: null,
                  })
                : applyResolvedCoverArt({
                    filePaths,
                    folderPath: dirname(filePaths[0] ?? ""),
                    isDryRun,
                    isEmbedded,
                    isSavedBesideFiles,
                    resolvedCoverArt,
                  }),
            ),
          ),
    ),
    logAndRethrowPipelineError(applyCoverArt),
  )
