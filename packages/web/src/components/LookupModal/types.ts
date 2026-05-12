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

export type LookupSearchResult = {
  malId?: number
  aid?: number
  tvdbId?: number
  movieDbId?: number
  name?: string
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
  loading: boolean
}
