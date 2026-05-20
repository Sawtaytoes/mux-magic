// Builds the `NN - Title.flac` per-track filename used as the output
// of a CUE-sheet split. Pure, no FS access.

// Windows-reserved filename characters per
// https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
// — we strip rather than substitute so e.g. "AC/DC" becomes "ACDC"
// instead of "AC_DC". Substitution can mask collisions with another
// album that legitimately had "ACDC" in the title.
// biome-ignore lint/suspicious/noControlCharactersInRegex: 0x00–0x1F are reserved on Windows too
const reservedCharsRegex = /[<>:"/\\|?*\x00-\x1F]/g
const whitespaceRunRegex = /\s+/g

const sanitizeTitle = (title: string): string =>
  title
    .replace(reservedCharsRegex, "")
    .replace(whitespaceRunRegex, " ")
    .trim()

export const cueTrackToOutputFilename = (
  trackNumber: number,
  title: string,
): string => {
  if (!Number.isInteger(trackNumber) || trackNumber < 1) {
    throw new Error(
      `cueTrackToOutputFilename: track number must be a positive integer; received ${trackNumber}.`,
    )
  }
  const sanitized = sanitizeTitle(title)
  if (sanitized === "") {
    throw new Error(
      `cueTrackToOutputFilename: title became empty after sanitization (input: ${JSON.stringify(title)}).`,
    )
  }
  const padded = String(trackNumber).padStart(2, "0")
  return `${padded} - ${sanitized}.flac`
}
