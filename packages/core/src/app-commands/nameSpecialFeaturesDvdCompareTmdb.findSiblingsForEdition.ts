import { extname } from "node:path"

// Known Plex special-feature suffixes — a file whose stem ends with one
// of these is a sibling of the main feature whose stem matches after
// removing the suffix. Mirrors `PLEX_SPECIAL_FEATURE_SUFFIXES` in
// `nameSpecialFeaturesDvdCompareTmdb.editionTag.ts` — kept local here
// to avoid a circular dependency between the two modules.
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

// Strip the file extension from a filename. Returns the stem.
const getStem = (filename: string) =>
  filename.slice(
    0,
    filename.length - extname(filename).length,
  )

// Returns true when `candidateFilename` is a Plex-suffix sibling of
// `mainStem` — i.e., removing one of the recognized Plex suffixes from
// the candidate's stem yields exactly `mainStem`.
const isSiblingOfMain = ({
  candidateFilename,
  mainStem,
}: {
  candidateFilename: string
  mainStem: string
}) => {
  const candidateStem = getStem(candidateFilename)
  return PLEX_SPECIAL_FEATURE_SUFFIXES.some(
    (suffix) => candidateStem === `${mainStem}${suffix}`,
  )
}

// Given a main-feature filename and the full list of filenames in the
// same folder, returns the filenames of every sibling file — i.e.,
// files whose name is `<mainStem><plexSuffix>.<ext>`. The main feature
// itself is excluded. Order matches the input `allFilenamesInFolder`
// order.
export const findSiblingsForEdition = ({
  mainFeatureFilename,
  allFilenamesInFolder,
}: {
  mainFeatureFilename: string
  allFilenamesInFolder: string[]
}): string[] => {
  const mainStem = getStem(mainFeatureFilename)
  return allFilenamesInFolder.filter(
    (candidateFilename) =>
      candidateFilename !== mainFeatureFilename &&
      isSiblingOfMain({ candidateFilename, mainStem }),
  )
}
