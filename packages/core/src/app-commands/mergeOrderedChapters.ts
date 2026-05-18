import { dirname, join } from "node:path"
import {
  getFiles,
  insertIntoArray,
  logAndRethrowPipelineError,
  logInfo,
} from "@mux-magic/tools"
import {
  concatMap,
  filter,
  map,
  scan,
  tap,
  toArray,
} from "rxjs"
import {
  FALLBACK_TIMECODE,
  getChapters,
} from "../cli-spawn-operations/getChapters.js"
import { mergeMediaFiles } from "../cli-spawn-operations/mergeMediaFiles.js"
import { splitSegmentFfmpeg } from "../cli-spawn-operations/splitChaptersFfmpeg.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export const FALLBACK_INTRO_FILENAME = "merge-intro.mkv"
export const FALLBACK_OUTRO_FILENAME = "merge-outro.mkv"

export const mergeOrderedChapters = ({
  insertIntroAtIndex,
  insertOutroAtIndex,
  introFilename = FALLBACK_INTRO_FILENAME,
  outroFilename = FALLBACK_OUTRO_FILENAME,
  sourcePath,
}: {
  insertIntroAtIndex: number
  insertOutroAtIndex: number
  introFilename?: string
  outroFilename?: string
  sourcePath: string
}) =>
  getFiles({
    sourcePath,
  }).pipe(
    filterIsVideoFile(),
    filter(
      (fileInfo) =>
        fileInfo.filename !== introFilename &&
        fileInfo.filename !== outroFilename,
    ),
    withFileProgress((fileInfo) =>
      // ------------- OLD START
      // getChaptersOld(
      //   fileInfo
      //   .fullPath
      // )
      // ------------- OLD END
      // ------------- NEW START
      getChapters(fileInfo.fullPath)
        // ------------- NEW END
        .pipe(
          // ------------- OLD START
          // pairwise(),
          // map(([
          //   startChapter,
          //   endChapter,
          // ]) => ({
          //   endTimecode: (
          //     endChapter
          //     .timecode
          //   ),
          //   startTimecode: (
          //     startChapter
          //     .timecode
          //   ),
          // })),
          // ------------- OLD END

          // ------------- NORMAL START
          scan(
            (
              { hasInitialTimecode },
              { endTimecode, startTimecode },
            ) =>
              hasInitialTimecode &&
              startTimecode === FALLBACK_TIMECODE
                ? {
                    endTimecode: FALLBACK_TIMECODE,
                    hasInitialTimecode,
                    startTimecode: FALLBACK_TIMECODE,
                  }
                : {
                    endTimecode,
                    hasInitialTimecode:
                      hasInitialTimecode ||
                      startTimecode === FALLBACK_TIMECODE,
                    startTimecode,
                  },
            {
              endTimecode: FALLBACK_TIMECODE,
              hasInitialTimecode: false,
              startTimecode: FALLBACK_TIMECODE,
            } as {
              endTimecode: string
              hasInitialTimecode: boolean
              startTimecode: string
            },
          ),
          filter(
            ({ endTimecode }) =>
              endTimecode !== FALLBACK_TIMECODE,
          ),
          concatMap(
            ({ endTimecode, startTimecode }, index) =>
              splitSegmentFfmpeg({
                endTimecode,
                filePath: fileInfo.fullPath,
                segmentId: String(index),
                startTimecode,
              }).pipe(
                tap(() => {
                  logInfo(
                    "CHAPTERS SPLIT",
                    fileInfo.fullPath,
                  )
                }),
                filter(Boolean),
              ),
          ),
          // ------------- NORMAL END

          // ------------- TEMP START
          // take(1),
          // concatMap(() => (
          //   readFiles({
          //     sourcePath: (
          //       join(
          //         (
          //           dirname(
          //             fileInfo
          //             .fullPath
          //           )
          //         ),
          //         segmentSplitsFolderName,
          //       )
          //     ),
          //   })
          //   .pipe(
          //     map((
          //       fileInfo
          //     ) => (
          //       fileInfo
          //       .fullPath
          //     )),
          //   )
          // )),
          // ------------- TEMP END

          toArray(),
          map((segmentFilePaths) => ({
            introOutroDirectory: dirname(fileInfo.fullPath),
            segmentFilePaths,
          })),
          concatMap(
            ({ introOutroDirectory, segmentFilePaths }) =>
              mergeMediaFiles({
                filePaths: [
                  {
                    chapterNumber: insertIntroAtIndex,
                    filename: introFilename,
                  },
                  {
                    chapterNumber: insertOutroAtIndex,
                    filename: outroFilename,
                  },
                ].reduce(
                  (
                    filePaths,
                    { chapterNumber, filename },
                  ) =>
                    insertIntoArray({
                      array: filePaths,
                      index: chapterNumber - 1,
                      value: join(
                        introOutroDirectory,
                        filename,
                      ),
                    }),
                  segmentFilePaths,
                ),
                originalFilePath: fileInfo.fullPath,
              }),
          ),
        ),
    ),
    toArray(),
    logAndRethrowPipelineError(mergeOrderedChapters),
  )
