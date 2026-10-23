import { createHash, randomUUID } from "node:crypto"
import {
  mkdir,
  rename,
  rmdir,
  stat,
  unlink,
} from "node:fs/promises"
import { dirname, extname, join } from "node:path"
import {
  aclSafeCopyFile,
  getFilesAtDepth,
  logAndRethrowPipelineError,
} from "@mux-magic/tools"
import { defer, filter, toArray } from "rxjs"
import { applyDefaultAssHeaderRules } from "../tools/applyDefaultAssHeaderRules.js"
import {
  inspectMatroskaTrackHeaders,
  readMatroskaTracks,
  rewriteMatroskaSubtitleHeaders,
  writeMatroskaTracks,
} from "../tools/matroskaSubtitleHeaders.js"
import { SUBTITLE_DEFAULTS_FOLDER_NAME } from "../tools/outputFolderNames.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const applyEmbeddedSubtitleDefaultsDefaultProps = {
  outputFolderName: SUBTITLE_DEFAULTS_FOLDER_NAME,
} as const

const fail = (message: string): never => {
  throw new Error(
    `Apply embedded subtitle defaults: ${message}`,
  )
}

const withDestinationClaim = <Result>({
  lockPath,
  action,
}: {
  lockPath: string
  action: () => Promise<Result>
}) =>
  mkdir(lockPath).then(() =>
    action().finally(() => rmdir(lockPath)),
  )

const applyToFile = (filePath: string) =>
  ((destinationPath) =>
    ((temporaryPath) =>
      Promise.all([
        stat(filePath),
        readMatroskaTracks(filePath),
      ])
        .then(([sourceStat, tracks]) =>
          ((modified) =>
            mkdir(dirname(destinationPath), {
              recursive: true,
            }).then(() =>
              withDestinationClaim({
                lockPath: join(
                  dirname(destinationPath),
                  `.subtitle-defaults-${createHash("sha256").update(destinationPath).digest("hex")}.lock`,
                ),
                action: () =>
                  stat(destinationPath)
                    .then(
                      () =>
                        fail("destination already exists"),
                      (error: NodeJS.ErrnoException) =>
                        error.code === "ENOENT"
                          ? undefined
                          : Promise.reject(error),
                    )
                    .then(() =>
                      aclSafeCopyFile(
                        filePath,
                        temporaryPath,
                      ),
                    )
                    .then(() =>
                      stat(filePath).then((currentStat) =>
                        currentStat.size ===
                          sourceStat.size &&
                        currentStat.mtimeMs ===
                          sourceStat.mtimeMs &&
                        currentStat.ino === sourceStat.ino
                          ? writeMatroskaTracks({
                              filePath: temporaryPath,
                              buffer: modified,
                              position: tracks.position,
                            }).then(() =>
                              Promise.all([
                                stat(temporaryPath),
                                readMatroskaTracks(
                                  temporaryPath,
                                ),
                              ]).then(
                                ([
                                  outputStat,
                                  outputTracks,
                                ]) =>
                                  outputStat.size ===
                                    sourceStat.size &&
                                  outputTracks.buffer.equals(
                                    modified,
                                  )
                                    ? rename(
                                        temporaryPath,
                                        destinationPath,
                                      ).then(() => ({
                                        filePath:
                                          destinationPath,
                                        isHeaderChanged:
                                          !modified.equals(
                                            tracks.buffer,
                                          ),
                                        hasRewrittenMediaPackets: false,
                                        subtitleTrackNumbers:
                                          inspectMatroskaTrackHeaders(
                                            tracks.buffer,
                                          )
                                            .filter(
                                              (track) =>
                                                track.codecId ===
                                                "S_TEXT/ASS",
                                            )
                                            .map(
                                              (track) =>
                                                track.number,
                                            ),
                                        modifiedRegion: {
                                          offset:
                                            tracks.position,
                                          length:
                                            modified.length,
                                        },
                                      }))
                                    : fail(
                                        "staged verification failed",
                                      ),
                              ),
                            )
                          : fail(
                              "source changed during the operation",
                            ),
                      ),
                    ),
              }),
            ))(
            rewriteMatroskaSubtitleHeaders({
              buffer: tracks.buffer,
              transform: applyDefaultAssHeaderRules,
            }),
          ),
        )
        .catch((error: unknown) =>
          unlink(temporaryPath)
            .catch(() => undefined)
            .then(() => {
              throw error
            }),
        ))(
      join(
        dirname(destinationPath),
        `.${randomUUID()}.subtitle-defaults.tmp`,
      ),
    ))(
    join(
      dirname(filePath),
      SUBTITLE_DEFAULTS_FOLDER_NAME,
      filePath.split(/[\\/]/).at(-1) ?? "",
    ),
  )

export const applyEmbeddedSubtitleDefaults = ({
  sourcePath,
  isRecursive = false,
  recursiveDepth = 1,
}: {
  sourcePath: string
  isRecursive?: boolean
  recursiveDepth?: number
}) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth : 0,
    sourcePath,
  }).pipe(
    filter(
      (fileInfo) =>
        extname(fileInfo.fullPath).toLowerCase() ===
          ".mkv" &&
        !fileInfo.fullPath
          .split(/[\\/]/)
          .includes(SUBTITLE_DEFAULTS_FOLDER_NAME),
    ),
    withFileProgress((fileInfo) =>
      defer(() => applyToFile(fileInfo.fullPath)),
    ),
    toArray(),
    logAndRethrowPipelineError(
      applyEmbeddedSubtitleDefaults,
    ),
  )
