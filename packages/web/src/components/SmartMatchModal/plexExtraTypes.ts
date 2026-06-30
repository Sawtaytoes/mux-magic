// Plex local-extras suffix vocabulary — canonical list per the 2023-07-31 decision.
// Do NOT add or rename entries; these are Plex's literal recognized suffix strings.
// See: docs/decisions/2023-07-31-plex-extras-suffix-vocabulary.md

export const PLEX_EXTRA_TYPES = [
  { suffix: "", label: "— no type —" },
  { suffix: "-trailer", label: "Trailer" },
  { suffix: "-featurette", label: "Featurette" },
  { suffix: "-interview", label: "Interview" },
  {
    suffix: "-behindthescenes",
    label: "Behind the Scenes",
  },
  { suffix: "-scene", label: "Scene" },
  { suffix: "-deleted", label: "Deleted Scene" },
  { suffix: "-short", label: "Short" },
  { suffix: "-other", label: "Other" },
] as const

// Derive the union of known non-empty suffix strings for exhaustiveness.
type PlexExtraTypeTuple = (typeof PLEX_EXTRA_TYPES)[number]
export type PlexExtraSuffix = PlexExtraTypeTuple["suffix"]

// Extract the known non-empty suffixes as a runtime array for checks.
const KNOWN_SUFFIXES = PLEX_EXTRA_TYPES.filter(
  (plexType) => plexType.suffix.length > 0,
).map((plexType) => plexType.suffix)

// Extract the Plex suffix from an existing filename stem (the stem is the
// filename without extension). Returns the matching suffix string (e.g.
// `'-featurette'`) or `''` if none of the known suffixes are found.
// Case-insensitive — the stem is lowercased before comparison.
export const extractSuffixFromStem = (
  stem: string,
): string => {
  const lowercasedStem = stem.toLowerCase()
  return (
    KNOWN_SUFFIXES.find((suffix) =>
      lowercasedStem.endsWith(suffix),
    ) ?? ""
  )
}

// Keyword→suffix heuristic. Maps keywords in a candidate name to a Plex suffix.
// Intentional mappings per docs/decisions/2023-07-31-plex-extras-suffix-vocabulary.md:
//   documentary → -featurette (NOT -behindthescenes)
//   clip        → -featurette
// Returns '' when no keyword matches — the type is unknown and the user must
// pick one explicitly. '-other' is NOT a fallback; it is only for positively
// identified "other" content (e.g. image galleries) whose suffix is already
// baked into the candidate name and recovered by extractSuffixFromStem.
export const inferSuffixFromName = (
  name: string,
): string => {
  const lowercasedName = name.toLowerCase()

  if (
    /\btrailer\b/.test(lowercasedName) ||
    /\bteaser\b/.test(lowercasedName)
  ) {
    return "-trailer"
  }

  // documentary and clip map to -featurette per the vocabulary decision —
  // check these BEFORE behind-the-scenes so "Making-of Documentary" doesn't
  // erroneously match the making-of pattern.
  if (
    /\bfeaturette\b/.test(lowercasedName) ||
    /\bdocumentary\b/.test(lowercasedName) ||
    /\bclip\b/.test(lowercasedName) ||
    /\bspotlight\b/.test(lowercasedName)
  ) {
    return "-featurette"
  }

  if (
    /\bbehind.the.scenes?\b/.test(lowercasedName) ||
    /\bmaking.of\b/.test(lowercasedName)
  ) {
    return "-behindthescenes"
  }

  if (
    /\binterview\b/.test(lowercasedName) ||
    /\bq\s*[&+]\s*a\b/.test(lowercasedName)
  ) {
    return "-interview"
  }

  if (/\bdeleted\b/.test(lowercasedName)) {
    return "-deleted"
  }

  if (/\bscene\b/.test(lowercasedName)) {
    return "-scene"
  }

  if (/\bshort\b/.test(lowercasedName)) {
    return "-short"
  }

  return ""
}

// Strip any known Plex suffix from the end of a base name string so a new
// suffix can be appended without double-suffixing. Returns the stem with
// the trailing suffix (and any surrounding whitespace) removed.
export const stripSuffixFromBase = (
  baseName: string,
): string => {
  const suffix = extractSuffixFromStem(baseName)
  if (suffix.length === 0) {
    return baseName
  }
  return baseName
    .slice(0, baseName.length - suffix.length)
    .trimEnd()
}

// Compose the final rename target from a base name and a selected Plex suffix.
// Always strips any existing Plex suffix from the base before appending, so
// you never produce a double-suffix like "Trailer -featurette -featurette".
// When suffix is '' (no type), returns the stripped base unchanged.
export const buildRenameTarget = (
  baseName: string,
  plexSuffix: string,
): string => {
  const strippedBase = stripSuffixFromBase(baseName)
  if (plexSuffix.length === 0) {
    return strippedBase
  }
  return `${strippedBase} ${plexSuffix}`
}
