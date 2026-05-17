import { access, readFile } from "node:fs/promises"
import { extname, join } from "node:path"
import {
  getFiles,
  getFolder,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import { XMLParser } from "fast-xml-parser"
import {
  catchError,
  combineLatest,
  concatAll,
  concatMap,
  EMPTY,
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
import {
  mergeSubtitlesMkvMerge,
  mergeSubtitlesMkvMergeDefaultProps,
} from "../cli-spawn-operations/mergeSubtitlesMkvMerge.js"
import type { ChaptersXml } from "../tools/ChaptersXml.js"
import { subtitlesFileExtensionSet } from "../tools/filterIsSubtitlesFile.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import {
  convertTimecodeToMilliseconds,
  parseMediaFileChapterTimestamp,
} from "../tools/parseTimestamps.js"
import { withFileProgress } from "../tools/progressEmitter.js"

const xmlParser = new XMLParser()

type AddSubtitlesRequiredProps = {
  sourcePath: string
  subtitlesPath: string
}

type AddSubtitlesOptionalProps = {
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

export type AddSubtitlesProps = AddSubtitlesRequiredProps &
  AddSubtitlesOptionalProps

export const addSubtitlesDefaultProps = {
  globalOffsetInMilliseconds: 0,
  hasChapterSyncOffset: false,
  hasChapters: false,
  offsetsInMilliseconds: [] as number[],
  outputFolderName:
    mergeSubtitlesMkvMergeDefaultProps.outputFolderName,
} satisfies AddSubtitlesOptionalProps

export const addSubtitles = ({
  globalOffsetInMilliseconds = addSubtitlesDefaultProps.globalOffsetInMilliseconds,
  hasChapterSyncOffset = addSubtitlesDefaultProps.hasChapterSyncOffset,
  hasChapters = addSubtitlesDefaultProps.hasChapters,
  sourcePath,
  offsetsInMilliseconds = addSubtitlesDefaultProps.offsetsInMilliseconds,
  outputFolderName = addSubtitlesDefaultProps.outputFolderName,
  subtitlesPath,
}: AddSubtitlesProps) =>
  combineLatest([
    getFolder({
      sourcePath: subtitlesPath,
    }).pipe(toArray()),
    getFiles({
      sourcePath,
    }).pipe(toArray()),
  ]).pipe(
    concatMap(([subtitlesFolder, mediaFiles]) =>
      from(mediaFiles).pipe(
        withFileProgress((mediaFileInfo) =>
          from(subtitlesFolder).pipe(
            filter(
              (subtitlesFolderInfo) =>
                subtitlesFolderInfo.folderName ===
                mediaFileInfo.filename,
            ),
            take(1),
            concatMap((subtitlesFolderInfo) =>
              combineLatest([
                subtitlesFolderInfo.fullPath,
                getFiles({
                  sourcePath: subtitlesFolderInfo.fullPath,
                }).pipe(
                  filter((subtitlesFileInfo) =>
                    subtitlesFileExtensionSet.has(
                      extname(subtitlesFileInfo.fullPath),
                    ),
                  ),
                  map(
                    (subtitlesFileInfo) =>
                      subtitlesFileInfo.fullPath,
                  ),
                  toArray(),
                ),
                from(
                  access(
                    join(
                      subtitlesFolderInfo.fullPath,
                      "attachments",
                    ),
                  ),
                ).pipe(
                  concatMap(() =>
                    getFiles({
                      sourcePath: join(
                        subtitlesFolderInfo.fullPath,
                        "attachments",
                      ),
                    }),
                  ),
                  map(
                    (attachmentsFileInfo) =>
                      attachmentsFileInfo.fullPath,
                  ),
                  catchError(() => of(null)),
                  toArray(),
                  concatAll(),
                  filter(Boolean),
                  toArray(),
                ),
                hasChapterSyncOffset
                  ? getFiles({
                      sourcePath:
                        subtitlesFolderInfo.fullPath,
                    }).pipe(
                      filter((subtitlesFileInfo) =>
                        subtitlesFileInfo.fullPath.endsWith(
                          "chapters.xml",
                        ),
                      ),
                      take(1),
                      concatMap((subtitlesFileInfo) =>
                        zip([
                          from(
                            readFile(
                              subtitlesFileInfo.fullPath,
                            ),
                          ).pipe(
                            map(
                              (chaptersXml) =>
                                xmlParser.parse(
                                  chaptersXml,
                                ) as ChaptersXml,
                            ),
                            map(
                              (chaptersJson) =>
                                chaptersJson.Chapters
                                  .EditionEntry.ChapterAtom,
                            ),
                            concatAll(),
                            map(
                              (chapterAtom) =>
                                chapterAtom.ChapterTimeStart,
                            ),
                            map(
                              (subtitlesChapterTimestamp) =>
                                convertTimecodeToMilliseconds(
                                  subtitlesChapterTimestamp,
                                ),
                            ),
                          ),
                          getMediaInfo(
                            mediaFileInfo.fullPath,
                          ).pipe(
                            map(
                              (mediaInfo) =>
                                mediaInfo?.media?.track
                                  .flatMap((track) =>
                                    track["@type"] ===
                                    "Menu"
                                      ? track
                                      : [],
                                  )
                                  .find(Boolean)?.extra,
                            ),
                            filter(Boolean),
                            take(1),
                            map((chapters) =>
                              Object.keys(chapters).map(
                                (chapterTimestamp) =>
                                  parseMediaFileChapterTimestamp(
                                    chapterTimestamp,
                                  ),
                              ),
                            ),
                            concatAll(),
                          ),
                        ]).pipe(
                          skip(1),
                          concatMap(
                            ([
                              subtitlesChapterTimestamp,
                              mediaFileChapterTimestamp,
                            ]) => {
                              const offsetInMilliseconds =
                                mediaFileChapterTimestamp -
                                subtitlesChapterTimestamp

                              logInfo(
                                "CHAPTER OFFSET",
                                "mediaFileChapterTimestamp=".concat(
                                  String(
                                    mediaFileChapterTimestamp,
                                  ),
                                  " subtitlesChapterTimestamp=",
                                  String(
                                    subtitlesChapterTimestamp,
                                  ),
                                  " offsetInMilliseconds=",
                                  String(
                                    offsetInMilliseconds,
                                  ),
                                ),
                              )

                              return offsetInMilliseconds ===
                                0
                                ? EMPTY
                                : of(offsetInMilliseconds)
                            },
                          ),
                          take(1),
                        ),
                      ),
                    )
                  : of(globalOffsetInMilliseconds),
              ]).pipe(
                concatMap(
                  (
                    [
                      subtitlesFolderPath,
                      subtitlesFilesPaths,
                      attachmentFilePaths,
                      offsetInMilliseconds,
                    ],
                    index,
                  ) =>
                    mergeSubtitlesMkvMerge({
                      attachmentFilePaths,
                      destinationFilePath:
                        mediaFileInfo.fullPath,
                      chaptersFilePath: hasChapters
                        ? join(
                            subtitlesFolderPath,
                            "chapters.xml",
                          )
                        : undefined,
                      offsetInMilliseconds:
                        offsetsInMilliseconds.length > 0
                          ? offsetsInMilliseconds[index]
                          : offsetInMilliseconds,
                      outputFolderName,
                      subtitlesFilesPaths,
                      subtitlesLanguage: "eng",
                    }),
                ),
                tap(() => {
                  logInfo(
                    "CREATED MERGED FILE",
                    mediaFileInfo.fullPath,
                  )
                }),
                filter(Boolean),
              ),
            ),
          ),
        ),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(addSubtitles),
  )
