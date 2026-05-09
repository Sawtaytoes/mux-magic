import {
  dirname,
  join,
} from "node:path"

import { runMkvMerge } from "./runMkvMerge.js";

export const constantBitrateFolderName = "CONSTANT-BITRATE"

export const convertVariableToConstantBitrate = ({
  framesPerSecond,
  filePath,
}: {
  /** This value can be `24`, `30`, `60`, etc or even `24000/1001`, but simply using `24` is going to have the same outcome. */
  framesPerSecond: string,
  filePath: string,
}) => (
  runMkvMerge({
    args: [
      "--default-duration",
      `0:${framesPerSecond}fps`,

      filePath,
    ],
    outputFilePath: (
      filePath
      .replace(
        (
          dirname(
            filePath
          )
        ),
        (
          join(
            (
              dirname(
                filePath
              )
            ),
            constantBitrateFolderName,
          )
        ),
      )
    )
  })
)
