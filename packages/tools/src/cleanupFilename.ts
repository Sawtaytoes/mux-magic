export const cleanupFilename = (filename: string) =>
  filename
    .replaceAll("\n", " ")
    .replaceAll(/(\w): /g, "$1 - ")
    .replaceAll(/:/g, "-")
    .replaceAll("?", "_")
    .replaceAll('"', "")
    .replaceAll("/", "-")
    .replaceAll("<", "[")
    .replaceAll(">", "]")
    .replaceAll("*", "@")
    .replaceAll("...", "--")
    .replaceAll(" | ", " - ")
    .trim()
