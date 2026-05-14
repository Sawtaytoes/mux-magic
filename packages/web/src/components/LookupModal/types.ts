// Types owned by LookupModal and its sub-stages.
// Used across:
//   - LookupModal.tsx / .stories
//   - LookupSearchStage / LookupVariantStage / LookupReleaseStage
//   - NumberWithLookupField (kicks off a lookup)
//   - lookupModalAtom (post-uiAtoms split)

export type LookupType =
  | "mal"
  | "anidb"
  | "tvdb"
  | "tmdb"
  | "dvdcompare"

export type LookupStage = "search" | "variant" | "release"

// eslint-disable-next-line no-restricted-syntax -- web-only normalized search result; not in server/api-types (server emits per-provider types)
export type LookupSearchResult = {
  malId?: number
  aid?: number
  tvdbId?: number
  movieDbId?: number
  name?: string
  // Native-script title (Japanese for MAL/AniDB) shown as a muted
  // subtitle under the primary name in the picker.
  nameJapanese?: string
  title?: string
  year?: string
}

export type LookupVariant = {
  id: string
  variant: string
}

export type LookupGroup = {
  baseTitle: string
  year?: string
  variants: LookupVariant[]
}

export type LookupRelease = {
  hash: string | number
  label: string
}

export type LookupState = {
  lookupType: LookupType
  stepId: string
  fieldName: string
  // Companion field that receives the human-readable label (e.g. movie title).
  // The primary fieldName receives only the numeric id/hash — keeping that
  // field a plain number is what NumberWithLookupField expects (otherwise
  // React tries to render an object as text and prints "[object Object]").
  companionNameField: string | null
  stage: LookupStage
  searchTerm: string
  searchError: string | null
  results: LookupSearchResult[] | null
  formatFilter: string
  selectedGroup: LookupGroup | null
  selectedVariant: string | null
  selectedFid: string | null
  releases: LookupRelease[] | null
  releasesDebug: unknown
  releasesError: string | null
  isLoading: boolean
}
