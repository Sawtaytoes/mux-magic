import { XMLParser } from "fast-xml-parser"
import {
  access,
  readFile,
} from "node:fs/promises"
import {
  extname,
  join,
} from "node:path"
import {
  EMPTY,
  catchError,
  combineLatest,
  concatAll,
  concatMap,
  filter,
  from,
  map,
  of,
  skip,
  take,
  tap,
  toArray,
  zip,
} from "rxjs"

import { logAndRethrow } from "../tools/logAndRethrow.js"
import { ChaptersXml } from "../tools/ChaptersXml.js"
import { subtitlesFileExtensionSet } from "../tools/filterIsSubtitlesFile.js"
import { getFiles } from "../tools/getFiles.js"
import { getFolder } from "../tools/getFolder.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import { logInfo } from "../tools/logMessage.js"
import { mergeSubtitlesMkvMerge, mergeSubtitlesMkvMergeDefaultProps } from "../cli-spawn-operations/mergeSubtitlesMkvMerge.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import {
  parseMediaFileChapterTimestamp,
  convertTimecodeToMilliseconds,
} from "../tools/parseTimestamps.js"

const xmlParser = (
  new XMLParser()
)

type MergeTracksRequiredProps = {
  mediaFilesPath: string
  subtitlesPath: string
}

type MergeTracksOptionalProps = {
  globalOffsetInMilliseconds?: number
  hasChapterSyncOffset?: boolean
  hasChapters?: boolean
  // Per-file audio offsets in ms. Defaults to [] when the caller (e.g. a
  // sequence step that doesn't supply offsets) omits it — without the
  // default the destructured value is undefined and the in-flight
  // `offsetsInMilliseconds.length > 0` check below throws TypeError.
  offsetsInMilliseconds?: number[]
  outputFolderName?: string
}

export type MergeTracksProps = MergeTracksRequiredProps & MergeTracksOptionalProps

export const mergeTracksDefaultProps = {
  globalOffsetInMilliseconds: 0,
  hasChapterSyncOffset: false,
  hasChapters: false,
  offsetsInMilliseconds: [] as number[],
  outputFolderName: mergeSubtitlesMkvMergeDefaultProps.outputFolderName,
} satisfies MergeTracksOptionalProps

export const mergeTracks = ({
  globalOffsetInMilliseconds = mergeTracksDefaultProps.globalOffsetInMilliseconds,
  hasChapterSyncOffset = mergeTracksDefaultProps.hasChapterSyncOffset,
  hasChapters = mergeTracksDefaultProps.hasChapters,
  mediaFilesPath,
  offsetsInMilliseconds = mergeTracksDefaultProps.offsetsInMilliseconds,
  outputFolderName = mergeTracksDefaultProps.outputFolderName,
  subtitlesPath,
}: MergeTracksProps) => (
  combineLatest([
    (
      getFolder({
        sourcePath: (
          subtitlesPath
        ),
      })
      .pipe(
        toArray(),
      )
    ),
    (
      getFiles({
        sourcePath: (
          mediaFilesPath
        ),
      })
      .pipe(
        toArray(),
      )
    ),
  ])
  .pipe(
    concatMap(([
      subtitlesFolder,
      mediaFiles,
    ]) => (
      from(
        mediaFiles
      )
      .pipe(
        withFileProgress((
          mediaFileInfo,
        ) => (
          from(
            subtitlesFolder
          )
          .pipe(
            filter((
              subtitlesFolderInfo,
            ) => (
              (
                subtitlesFolderInfo
                .folderName
              )
              === (
                mediaFileInfo
                .filename
              )
            )),
            take(1),
            concatMap((
              subtitlesFolderInfo,
            ) => (
              combineLatest([
                (
                  subtitlesFolderInfo
                  .fullPath
                ),
                (
                  getFiles({
                    sourcePath: (
                      subtitlesFolderInfo
                      .fullPath
                    ),
                  })
                  .pipe(
                    filter((
                      subtitlesFileInfo,
                    ) => (
                      subtitlesFileExtensionSet
                      .has(
                        extname(
                          subtitlesFileInfo
                          .fullPath
                        )
                      )
                    )),
                    map((
                      subtitlesFileInfo,
                    ) => (
                      subtitlesFileInfo
                      .fullPath
                    )),
                    toArray(),
                  )
                ),
                (
                  from(
                    access(
                      join(
                        (
                          subtitlesFolderInfo
                          .fullPath
                        ),
                        "attachments",
                      )
                    )
                  )
                  .pipe(
                    concatMap(() => (
                      getFiles({
                        sourcePath: (
                          join(
                            (
                              subtitlesFolderInfo
                              .fullPath
                            ),
                            "attachments",
                          )
                        ),
                      })
                    )),
                    map((
                      attachmentsFileInfo,
                    ) => (
                      attachmentsFileInfo
                      .fullPath
                    )),
                    catchError(() => (
                      of(
                        null
                      )
                    )),
                    toArray(),
                    concatAll(),
                    filter(
                      Boolean
                    ),
                    toArray(),
                  )
                ),
                (
                  hasChapterSyncOffset
                  ? (
                    getFiles({
                      sourcePath: (
                        subtitlesFolderInfo
                        .fullPath
                      ),
                    })
                    .pipe(
                      filter((
                        subtitlesFileInfo,
                      ) => (
                        subtitlesFileInfo
                        .fullPath
                        .endsWith(
                          "chapters.xml"
                        )
                      )),
                      take(1),
                      concatMap((
                        subtitlesFileInfo,
                      ) => (
                        zip([
                          (
                            from(
                              readFile(
                                subtitlesFileInfo
                                .fullPath
                              )
                            )
                            .pipe(
                              map((
                                chaptersXml,
                              ) => (
                                xmlParser
                                .parse(
                                  chaptersXml
                                ) as (
                                  ChaptersXml
                                )
                              )),
                              map((
                                chaptersJson,
                              ) => (
                                chaptersJson
                                .Chapters
                                .EditionEntry
                                .ChapterAtom
                              )),
                              concatAll(),
                              map((
                                chapterAtom,
                              ) => (
                                chapterAtom
                                .ChapterTimeStart
                              )),
                              map((
                                subtitlesChapterTimestamp
                              ) => (
                                convertTimecodeToMilliseconds(
                                  subtitlesChapterTimestamp
                                )
                              )),
                            )
                          ),
                          (
                            getMediaInfo(
                              mediaFileInfo
                              .fullPath
                            )
                            .pipe(
                              map((
                                mediaInfo,
                              ) => (
                                mediaInfo
                                ?.media
                                ?.track
                                .flatMap((
                                  track,
                                ) => (
                                  (
                                    track
                                    ["@type"]
                                  )
                                  === "Menu"
                                )
                                ? track
                                : []
                                )
                                .find(
                                  Boolean
                                )
                                ?.extra
                              )),
                              filter(
                                Boolean
                              ),
                              take(1),
                              map((
                                chapters,
                              ) => (
                                Object
                                .keys(
                                  chapters
                                )
                                .map((
                                  chapterTimestamp,
                                ) => (
                                  parseMediaFileChapterTimestamp(
                                    chapterTimestamp
                                  )
                                ))
                              )),
                              concatAll(),
                            )
                          ),
                        ])
                        .pipe(
                          skip(1),
                          concatMap(([
                            subtitlesChapterTimestamp,
                            mediaFileChapterTimestamp,
                          ]) => {
                            const offsetInMilliseconds = (
                              mediaFileChapterTimestamp
                              - subtitlesChapterTimestamp
                            )

                            console
                            .info({
                              mediaFileChapterTimestamp,
                              subtitlesChapterTimestamp,
                              offsetInMilliseconds,
                            })

                            return (
                              (
                                offsetInMilliseconds
                                === 0
                              )
                              ? EMPTY
                              : (
                                of(
                                  offsetInMilliseconds
                                )
                              )
                            )
                          }),
                          take(1),
                        )
                      )),
                    )
                  )
                  : (
                    of(
                      globalOffsetInMilliseconds
                    )
                  )
                ),
              ])
              .pipe(
                concatMap((
                  [
                    subtitlesFolderPath,
                    subtitlesFilesPaths,
                    attachmentFilePaths,
                    offsetInMilliseconds,
                  ],
                  index,
                ) => (
                  mergeSubtitlesMkvMerge({
                    attachmentFilePaths,
                    destinationFilePath: (
                      mediaFileInfo
                      .fullPath
                    ),
                    chaptersFilePath: (
                      hasChapters
                      ? (
                        join(
                          subtitlesFolderPath,
                          "chapters.xml",
                        )
                      )
                      : undefined
                    ),
                    offsetInMilliseconds: (
                      (
                        offsetsInMilliseconds
                        .length > 0
                      )
                      ? (
                        offsetsInMilliseconds
                        [index]
                      )
                      : offsetInMilliseconds
                    ),
                    outputFolderName,
                    subtitlesFilesPaths,
                    subtitlesLanguage: "eng",
                  })
                )),
                tap(() => {
                  logInfo(
                    "CREATED MERGED FILE",
                    (
                      mediaFileInfo
                      .fullPath
                    ),
                  )
                }),
                filter(
                  Boolean
                ),
              )
            )),
          )
        )),
      )
    )),
    toArray(),
    logAndRethrow(
      mergeTracks
    )
  )
)
