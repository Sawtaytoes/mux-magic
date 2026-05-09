import {
  extname,
} from "node:path"

export const replaceFileExtension = ({
  filePath,
  fileExtension,
}: {
  filePath: string
  fileExtension: string
}) => (
  filePath
  .replace(
    (
      extname(
        filePath
      )
    ),
    (
      fileExtension
    ),
  )
)
