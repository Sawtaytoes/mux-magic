import { extname } from "node:path"

// Parse the edition tag from an already-renamed filename stem (or full
// filename with extension). Returns the edition string (e.g. "Director's Cut")
// or null when the stem carries no {edition-…} tag.
export const parseEditionFromFilename = (
  filename: string,
): string | null => {
  const stem = filename.slice(
    0,
    filename.length - extname(filename).length,
  )
  const match = stem.match(/\{edition-([^}]+)\}/)
  return match ? match[1] : null
}

// Returns true when a renamed filename looks like a main-feature file
// (i.e. matches "Title (Year)" or "Title (Year) {edition-…}" without any
// Plex special-feature suffix like -trailer, -behindthescenes, etc.).
// The heuristic: if the stem ends in one of the known Plex suffixes it's
// a special feature; otherwise it's the main feature.
const PLEX_SPECIAL_FEATURE_SUFFIXES = [
  "-trailer",
  "-behindthescenes",
  "-deleted",
  "-featurette",
  "-interview",
  "-scene",
  "-short",
  "-other",
] as const

export const isMainFeatureFilename = (
  filename: string,
): boolean => {
  const stem = filename.slice(
    0,
    filename.length - extname(filename).length,
  )
  return !PLEX_SPECIAL_FEATURE_SUFFIXES.some((suffix) =>
    stem.endsWith(suffix),
  )
}
