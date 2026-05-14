// Types owned by LookupModal and its sub-stages.
// Used across:
//   - LookupModal.tsx / .stories
//   - LookupSearchStage / LookupVariantStage / LookupReleaseStage
//   - NumberWithLookupField (kicks off a lookup)
//   - lookupModalAtom (post-uiAtoms split)
//
// Canonical data shapes (LookupSearchResult, LookupType, LookupRelease) live
// on the server via @mux-magic/server/api-types — re-exported here so
// component imports stay path-stable. Web-side synthesis types (LookupVariant,
// LookupGroup) and UI state shapes (LookupStage, LookupState) stay local.

import type {
  LookupRelease,
  LookupSearchResult,
  LookupType,
} from "@mux-magic/server/api-types"

export type {
  LookupRelease,
  LookupSearchResult,
  LookupType,
}

export type LookupStage = "search" | "variant" | "release"

// Web-only synthesis: groupDvdCompareResults() in LookupSearchStage builds
// these by collapsing flat SearchDvdCompareResult[] into baseTitle+year
// groups. The server never emits this shape — it stays here.
export type LookupVariant = {
  id: string
  variant: string
}

export type LookupGroup = {
  baseTitle: string
  year?: string
  variants: LookupVariant[]
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
