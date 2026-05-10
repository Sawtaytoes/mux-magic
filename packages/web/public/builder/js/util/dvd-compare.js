/** User-facing label for DVDCompare format variants. */
export function displayDvdCompareVariant(variant) {
  return variant === "Blu-ray 4K" ? "UHD Blu-ray" : variant
}

/**
 * @param {string | null | undefined} displayName
 * @returns {{ baseTitle: string, year: string } | null}
 */
export function parseDvdCompareDisplayName(displayName) {
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
  return { baseTitle, year: yearMatch?.[1] || "" }
}
