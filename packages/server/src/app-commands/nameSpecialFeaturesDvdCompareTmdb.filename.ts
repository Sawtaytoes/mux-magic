import { extname } from "node:path"
import type { MovieIdentity } from "../tools/canonicalizeMovieTitle.js"

// Plex (and most filesystems) reject these characters; replace with safe
// ASCII fallbacks so the resulting names stay readable rather than just
// stripping characters and leaving awkward gaps.
export const sanitizeFilenameSegment = (
  name: string,
): string =>
  name
    .replace(/:/gu, " -")
    .replace(/\?/gu, "")
    .replace(/"/gu, "'")
    .replace(/[\\/|*<>]/gu, "")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: strips ASCII control chars from filenames
    .replace(/[\u0000-\u001f]/gu, "")
    .trim()

export const buildMovieBaseName = (
  movie: MovieIdentity,
): string => {
  const title = sanitizeFilenameSegment(movie.title)
  const yearPart = movie.year ? ` (${movie.year})` : ""
  return `${title}${yearPart}`
}

export const buildMovieFeatureName = (
  movie: MovieIdentity,
  cutName: string,
): string => {
  const editionPart = cutName
    ? ` {edition-${sanitizeFilenameSegment(cutName)}}`
    : ""
  return `${buildMovieBaseName(movie)}${editionPart}`
}

export const stripExtension = (filename: string): string =>
  filename.slice(
    0,
    filename.length - extname(filename).length,
  )
