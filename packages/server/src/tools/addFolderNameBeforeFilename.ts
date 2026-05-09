import {
  dirname,
  join,
} from "node:path"

export const addFolderNameBeforeFilename = ({
  filePath,
  folderName,
}: {
  filePath: string
  folderName: string
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
)
