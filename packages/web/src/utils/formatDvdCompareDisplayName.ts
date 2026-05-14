// Client-side mirror of the server's lookupDvdCompareFilm formatter
// (packages/server/src/tools/searchDvdCompare.ts). Both sides must
// produce byte-identical strings for the same baseTitle/variant/year so
// the picker selection and the typed-id reverse-lookup leave the same
// companion text in params — otherwise a refresh / ID toggle silently
// "fixes" the mismatch and the user sees the value flicker.
//
// Two non-obvious rules:
//   - "Blu-ray 4K" renders as "UHD Blu-ray" (matches DVDCompare's UI
//     terminology and the legacy displayDvdCompareVariant helper).
//   - Bare "DVD" suppresses the variant suffix entirely; only Blu-ray /
//     UHD entries get a `(<variant>)` segment. Years suffix as
//     `(<year>)` when present, omitted when not.

export const displayDvdCompareVariant = (
  variant: string,
): string =>
  variant === "Blu-ray 4K" ? "UHD Blu-ray" : variant

export const formatDvdCompareDisplayName = (args: {
  baseTitle: string
  variant?: string
  year?: string
}): string => {
  const variantSuffix =
    args.variant && args.variant !== "DVD"
      ? ` (${displayDvdCompareVariant(args.variant)})`
      : ""
  const yearSuffix = args.year ? ` (${args.year})` : ""
  return `${args.baseTitle}${variantSuffix}${yearSuffix}`
}
