// Splits a DVDCompare display name like "Akira (UHD Blu-ray) (1988)"
// into the bare title and the year. Used by the TMDB resolver to search
// for the canonical TMDB film matching a DVDCompare entry.

export type ParsedDvdCompareDisplayName = {
  baseTitle: string
  year: string
}

export const parseDvdCompareDisplayName = (
  displayName: string | null | undefined,
): ParsedDvdCompareDisplayName | null => {
  if (!displayName) return null
  const yearMatch = displayName.match(/\s*\((\d{4})\)\s*$/)
  const withoutYear = yearMatch
    ? displayName.slice(0, yearMatch.index).trim()
    : displayName.trim()
  const variantMatch = withoutYear.match(
    /\s*\((?:UHD Blu-ray|Blu-ray 4K|Blu-ray|DVD)\)\s*$/i,
  )
  const baseTitle = variantMatch
    ? withoutYear.slice(0, variantMatch.index).trim()
    : withoutYear
  return { baseTitle, year: yearMatch?.[1] ?? "" }
}
