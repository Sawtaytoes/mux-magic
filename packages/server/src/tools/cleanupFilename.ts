export const cleanupFilename = (
  filename: string,
) => (
  filename
  .replaceAll(
    /: /g,
    " - ",
  )
  .replaceAll(
    /:/g,
    "-",
  )
  .replaceAll(
    "?",
    "_",
  )
  .replaceAll(
    "\"",
    "",
  )
  .replaceAll(
    "/",
    "-",
  )
  .replaceAll(
    "<",
    "[",
  )
  .replaceAll(
    ">",
    "]",
  )
  .replaceAll(
    "*",
    "@",
  )
  .replaceAll(
    "...",
    "--",
  )
  .replaceAll(
    "\n",
    " ",
  )
)
