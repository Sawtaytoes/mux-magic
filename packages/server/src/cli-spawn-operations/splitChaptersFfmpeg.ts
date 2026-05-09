import { runFfmpeg } from "./runFfmpeg.js";
import { getOutputPath } from "../tools/getOutputPath.js";
import { makeDirectory } from "../tools/makeDirectory.js";
import { concatMap, map, of } from "rxjs";

export const segmentSplitsFolderName = "SEGMENT-SPLITS"

export const splitSegmentFfmpeg = ({
  endTimecode,
  filePath,
  segmentId,
  startTimecode,
}: {
  endTimecode: string
  filePath: string
  segmentId: string
  startTimecode: string
}) => (
  of(
    getOutputPath({
      fileExtension: `-${segmentId}.mkv`,
      filePath,
      folderName: segmentSplitsFolderName,
    })
  )
  .pipe(
    concatMap((
      outputFilePath,
    ) => (
      makeDirectory(
        getOutputPath({
          filePath,
          folderName: segmentSplitsFolderName,
        })
      )
      .pipe(
        concatMap(() => (
          runFfmpeg({
            args: [
              "-map",
              "0",

              "-c",
              "copy",

              "-ss",
              startTimecode,

              "-to",
              endTimecode,
            ],
            inputFilePaths: [
              filePath,
            ],
            outputFilePath,
          })
        )),
        map(() => (
          outputFilePath
        )),
      )
    )),
  )
)
