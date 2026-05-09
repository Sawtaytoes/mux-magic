import { runMkvPropEdit } from "./runMkvPropEdit.js"

export const setDisplayWidthMkvPropEdit = ({
  displayWidth,
  filePath,
}: {
  displayWidth: number
  filePath: string
}) => (
  runMkvPropEdit({
    args: [
      "--edit",
      `track:v1`,

      "--set",
      `display-width=${displayWidth}`,
    ],
    filePath,
  })
)
