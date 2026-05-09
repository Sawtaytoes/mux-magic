import {
  dirname,
  extname,
  join,
} from "node:path";

export const getOutputPath = ({
  fileExtension,
  filePath,
  folderName,
}: {
  fileExtension?: string,
  filePath: string,
  folderName: string,
}) => (
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
        folderName,
      )
    ),
  )
  .replace(
    (
      extname(
        filePath
      )
    ),
    (
      fileExtension
      || (
        extname(
          filePath
        )
      )
    ),
  )
)
