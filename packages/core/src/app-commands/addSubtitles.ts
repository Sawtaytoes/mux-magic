import { access, readFile } from "node:fs/promises"
import { dirname, extname, join } from "node:path"
import {
  type FileInfo,
  type FolderInfo,
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
  throwError,
  toArray,
  zip,
} from "rxjs"
import {
  mergeSubtitlesMkvMerge,
  mergeSubtitlesMkvMergeDefaultProps,
} from "../cli-spawn-operations/mergeSubtitlesMkvMerge.js"
import type { ChaptersXml } from "../tools/ChaptersXml.js"
import { subtitlesFileExtensionSet } from "../tools/filterIsSubtitlesFile.js"
import { getIsVideoFile } from "../tools/filterIsVideoFile.js"
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

// Errors with a precise diagnosis when sourcePath turned up no media
// files. The most common cause is wiring sourcePath (the media dir) and
// subtitlesPath (the per-file subtitle dirs) the wrong way round — that
// otherwise completes silently with `[]` ("Step completed — No items
// reported.") and reads like a regression. Detect the swap by shape: the
// subtitles dir holds folders and no video, the media dir holds video.
const throwNoMediaFilesError = ({
  sourcePath,
  subtitlesPath,
}: {
  sourcePath: string
  subtitlesPath: string
}) =>
  combineLatest([
    getFolder({ sourcePath }).pipe(toArray()),
    getFiles({ sourcePath: subtitlesPath }).pipe(
      filter((fileInfo) =>
        getIsVideoFile(fileInfo.fullPath),
      ),
      toArray(),
    ),
  ]).pipe(
    concatMap(([sourceFolders, subtitlesVideoFiles]) =>
      throwError(() => {
        const isSwapped =
          sourceFolders.length > 0 &&
          subtitlesVideoFiles.length > 0

        return new Error(
          isSwapped
            ? `addSubtitles: no video files in sourcePath "${sourcePath}", but it holds ${sourceFolders.length} subfolder(s) while subtitlesPath "${subtitlesPath}" holds ${subtitlesVideoFiles.length} video file(s). The two paths look swapped — set sourcePath to the media directory and subtitlesPath to the extracted-subtitles directory.`
            : `addSubtitles: no video files found in sourcePath "${sourcePath}". Point sourcePath at the directory containing your media files.`,
        )
      }),
    ),
  )

type MuxSubtitlesPerFileProps = {
  globalOffsetInMilliseconds: number
  hasChapterSyncOffset: boolean
  hasChapters: boolean
  offsetsInMilliseconds: number[]
  outputFolderName: string
  subtitlesFolder: FolderInfo[]
  videoFiles: FileInfo[]
}

// Mux each video file with the subtitle folder whose name matches the
// file's basename, emitting one `{ filePath }` record per muxed output so
// the job always reports what it produced (instead of the old
// `filter(Boolean)` tail that dropped the language-fix nulls and left
// results empty even on success). Kept as its own expression-bodied
// helper rather than inlined into the outer concatMap: a block-body arrow
// whose `return` is this deep a pipe trips the oxc parser vite uses.
const muxSubtitlesPerFile = ({
  globalOffsetInMilliseconds,
  hasChapterSyncOffset,
  hasChapters,
  offsetsInMilliseconds,
  outputFolderName,
  subtitlesFolder,
  videoFiles,
}: MuxSubtitlesPerFileProps) =>
  from(videoFiles).pipe(
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
                  sourcePath: subtitlesFolderInfo.fullPath,
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
                        map((subtitlesChapterTimestamp) =>
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
                                track["@type"] === "Menu"
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
                              String(offsetInMilliseconds),
                            ),
                          )

                          return offsetInMilliseconds === 0
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
            // mergeSubtitlesMkvMerge emits the optional language-fix
            // records ending with null; collapse them into one clean
            // per-media-file record. The output lands in the
            // outputFolderName subdir beside the source (mirrors that
            // op's own path math).
            toArray(),
            map(() => ({
              filePath: mediaFileInfo.fullPath.replace(
                dirname(mediaFileInfo.fullPath),
                join(
                  dirname(mediaFileInfo.fullPath),
                  outputFolderName,
                ),
              ),
            })),
            tap((result) => {
              logInfo(
                "CREATED MERGED FILE",
                result.filePath,
              )
            }),
          ),
        ),
      ),
    ),
  )

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
    concatMap(([subtitlesFolder, mediaFiles]) => {
      const videoFiles = mediaFiles.filter((fileInfo) =>
        getIsVideoFile(fileInfo.fullPath),
      )

      return videoFiles.length === 0
        ? throwNoMediaFilesError({
            sourcePath,
            subtitlesPath,
          })
        : muxSubtitlesPerFile({
            globalOffsetInMilliseconds,
            hasChapterSyncOffset,
            hasChapters,
            offsetsInMilliseconds,
            outputFolderName,
            subtitlesFolder,
            videoFiles,
          })
    }),
    toArray(),
    logAndRethrowPipelineError(addSubtitles),
  )
