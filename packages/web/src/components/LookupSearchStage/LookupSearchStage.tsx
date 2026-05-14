import type {
  DvdCompareResult,
  ListDvdCompareReleasesResponse,
  SearchAnidbResponse,
  SearchDvdCompareResponse,
  SearchMalResponse,
  SearchMovieDbResponse,
  SearchTvdbResponse,
} from "@mux-magic/server/api-types"
import { useEffect, useRef } from "react"
import { apiBase } from "../../apiBase"
import type {
  LookupGroup,
  LookupRelease,
  LookupSearchResult,
  LookupState,
  LookupType,
} from "../../components/LookupModal/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"

// Union of all five search endpoints' response envelopes. The
// per-endpoint discriminator lives in `results[number]`, not on the
// envelope itself, so the narrowing happens after we know which lookup
// type was requested.
// eslint-disable-next-line no-restricted-syntax -- file-local union of already-imported server types; not a locally-defined API shape
type AnySearchResponse =
  | SearchMalResponse
  | SearchAnidbResponse
  | SearchTvdbResponse
  | SearchMovieDbResponse
  | SearchDvdCompareResponse

const SEARCH_ENDPOINTS: Record<LookupType, string> = {
  mal: "/queries/searchMal",
  anidb: "/queries/searchAnidb",
  tvdb: "/queries/searchTvdb",
  tmdb: "/queries/searchMovieDb",
  dvdcompare: "/queries/searchDvdCompare",
}

const groupDvdCompareResults = (
  flat: DvdCompareResult[],
): LookupGroup[] => {
  const map = new Map<string, LookupGroup>()
  for (const item of flat) {
    const key = `${item.baseTitle}||${item.year}`
    if (!map.has(key)) {
      map.set(key, {
        baseTitle: item.baseTitle,
        year: item.year,
        variants: [],
      })
    }
    map.get(key)?.variants.push({
      id: String(item.id),
      variant: item.variant,
    })
  }
  return Array.from(map.values())
}

const fetchSearch = async (
  lookupType: LookupType,
  searchTerm: string,
): Promise<{
  results: LookupSearchResult[]
  // For dvdcompare only: when the upstream search.php redirected
  // straight to a single film page (uniquely-spelled titles like the
  // misspelling "Tinker Tailor Solider Spy" → fid=55420), the API reports
  // isDirectListing=true and returns the one matching record. The UI
  // bypasses the picker and loads releases for that record directly,
  // ignoring the user's format filter since the direct hit is canonical.
  directListingResult: DvdCompareResult | null
  error: string | null
}> => {
  try {
    const resp = await fetch(
      `${apiBase}${SEARCH_ENDPOINTS[lookupType]}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchTerm }),
      },
    )
    if (!resp.ok) {
      return {
        results: [],
        directListingResult: null,
        error: `Server error: ${resp.status} ${resp.statusText}`,
      }
    }
    const data = (await resp.json()) as AnySearchResponse
    const rawResults = (data.results ??
      []) as LookupSearchResult[]
    const results =
      lookupType === "dvdcompare"
        ? (groupDvdCompareResults(
            rawResults as unknown as DvdCompareResult[],
          ) as unknown as LookupSearchResult[])
        : rawResults
    // A "direct listing" is when DVDCompare's search produced a single
    // canonical hit. Two signals indicate this, either of which is enough:
    //   1) Server set isDirectListing=true (its POST followed an HTTP
    //      redirect to film.php for a unique-title match like "solider").
    //   2) The raw search result list has exactly one entry — DVDCompare
    //      returned a single-row results page rather than a redirect.
    // Both cases mean the user has nothing to pick from at this stage, so
    // the UI must skip the picker and load releases for that one film.
    // Ignoring the format filter is intentional: when there's only one
    // film to choose, the filter shouldn't be allowed to turn it into
    // "No results."
    const directListingResult =
      lookupType === "dvdcompare" && rawResults.length === 1
        ? (rawResults[0] as unknown as DvdCompareResult)
        : null
    return {
      results,
      directListingResult,
      error: data.error ?? null,
    }
  } catch (error) {
    return {
      results: [],
      directListingResult: null,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    }
  }
}

// The server-side schema for /queries/listDvdCompareReleases requires
// `dvdCompareId: z.number()`. The UI carries IDs as strings (because they
// live in URL fragments and HTML attributes), so this helper coerces
// before sending. A string body produced a 400 Bad Request whose response
// payload included an object error — React then crashed trying to render
// `{name, message}` as text. Number coercion + explicit ok-check end both.
const fetchReleases = async (
  dvdCompareId: string,
): Promise<{
  releases: LookupRelease[]
  debug: unknown
  error: string | null
}> => {
  const numId = Number(dvdCompareId)
  if (Number.isNaN(numId)) {
    return {
      releases: [],
      debug: null,
      error: "Invalid DVDCompare ID",
    }
  }
  try {
    const resp = await fetch(
      `${apiBase}/queries/listDvdCompareReleases`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dvdCompareId: numId }),
      },
    )
    if (!resp.ok) {
      return {
        releases: [],
        debug: null,
        error: `Server error: ${resp.status} ${resp.statusText}`,
      }
    }
    const data =
      (await resp.json()) as ListDvdCompareReleasesResponse
    let error: unknown = data.error ?? null
    if (
      error &&
      typeof error === "object" &&
      "message" in error
    ) {
      error =
        (error as { message?: string }).message ??
        String(error)
    } else if (error && typeof error !== "string") {
      error = String(error)
    }
    return {
      releases: (data.releases ?? []) as LookupRelease[],
      debug: data.debug ?? null,
      error: typeof error === "string" ? error : null,
    }
  } catch (error) {
    return {
      releases: [],
      debug: null,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    }
  }
}

interface LookupSearchStageProps {
  state: LookupState
  onUpdate: (patch: Partial<LookupState>) => void
  onClose: () => void
}

export const LookupSearchStage = ({
  state,
  onUpdate,
  onClose,
}: LookupSearchStageProps) => {
  const { setParam } = useBuilderActions()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const loadReleasesForFid = async (
    group: LookupGroup,
    fidString: string,
    variantLabel: string,
  ) => {
    onUpdate({
      isLoading: true,
      selectedGroup: group,
      selectedFid: fidString,
      selectedVariant: variantLabel,
      stage: "release",
    })
    const { releases, debug, error } =
      await fetchReleases(fidString)
    onUpdate({
      releases,
      releasesDebug: debug,
      releasesError: error,
      isLoading: false,
    })
  }

  const runSearch = async () => {
    const term = state.searchTerm.trim()
    if (!term) return
    onUpdate({ isLoading: true, searchError: null })
    const { results, directListingResult, error } =
      await fetchSearch(state.lookupType, term)
    // Direct hit on DVDCompare: server redirected search.php to a single
    // film page (e.g. "solider" → fid=55420). Skip the picker entirely
    // and jump straight to release selection for that one film.
    if (directListingResult) {
      const fidString = String(directListingResult.id)
      const syntheticGroup: LookupGroup = {
        baseTitle: directListingResult.baseTitle,
        year: directListingResult.year,
        variants: [
          {
            id: fidString,
            variant: directListingResult.variant,
          },
        ],
      }
      await loadReleasesForFid(
        syntheticGroup,
        fidString,
        directListingResult.variant,
      )
      return
    }
    onUpdate({
      isLoading: false,
      results,
      searchError: error,
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") void runSearch()
  }

  const filteredResults =
    state.results === null
      ? null
      : state.lookupType === "dvdcompare" &&
          state.formatFilter !== "all"
        ? (
            state.results as unknown as LookupGroup[]
          ).filter((group) =>
            group.variants?.some(
              (variant) =>
                variant.variant === state.formatFilter,
            ),
          )
        : state.results

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="lookup-search-input"
          type="text"
          value={state.searchTerm}
          onChange={(event) =>
            onUpdate({ searchTerm: event.target.value })
          }
          onKeyDown={handleKeyDown}
          placeholder="Search…"
          className="flex-1 bg-slate-700 border border-slate-600 text-slate-100 text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={
            state.isLoading || !state.searchTerm.trim()
          }
          className="text-xs bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white px-3 py-1.5 rounded font-medium"
        >
          {state.isLoading ? "Searching…" : "Search"}
        </button>
      </div>

      {state.lookupType === "dvdcompare" && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Format:</span>
          {["Blu-ray 4K", "Blu-ray", "DVD", "all"].map(
            (format) => (
              <button
                type="button"
                key={format}
                onClick={() =>
                  onUpdate({ formatFilter: format })
                }
                className={`px-2 py-0.5 rounded border ${
                  state.formatFilter === format
                    ? "border-blue-500 text-blue-300 bg-blue-900/30"
                    : "border-slate-600 text-slate-400 hover:border-slate-500"
                }`}
              >
                {format}
              </button>
            ),
          )}
        </div>
      )}

      {state.searchError && (
        <p className="text-rose-400 text-xs">
          {state.searchError}
        </p>
      )}

      {filteredResults !== null &&
        filteredResults.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-4">
            No results.
          </p>
        )}

      {filteredResults !== null &&
        filteredResults.length > 0 && (
          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
            {filteredResults.map((result, index) => {
              const typedResult =
                result as LookupSearchResult & {
                  baseTitle?: string
                  year?: string
                  variants?: {
                    id: string
                    variant: string
                  }[]
                  malId?: number
                  aid?: number
                  tvdbId?: number
                  movieDbId?: number
                  name?: string
                  nameJapanese?: string
                  title?: string
                }
              const baseLabel =
                state.lookupType === "tmdb"
                  ? (typedResult.title ?? "—")
                  : (typedResult.name ??
                    typedResult.baseTitle ??
                    "—")
              const label = typedResult.year
                ? `${baseLabel} (${typedResult.year})`
                : baseLabel
              const japaneseSubtitle =
                typedResult.nameJapanese
              const keyHint =
                index < 9 ? (
                  <span className="text-xs font-mono bg-slate-700 px-1 rounded mr-2 shrink-0">
                    {index + 1}
                  </span>
                ) : null

              const handleSelect = () => {
                if (state.lookupType === "dvdcompare") {
                  const group =
                    result as unknown as LookupGroup
                  if (
                    !group.variants ||
                    group.variants.length === 0
                  )
                    return
                  // No more disc-type picker. The user already chose a
                  // Format at the top of the modal (Blu-ray 4K by
                  // default for dvdcompare). Narrow to variants matching
                  // that filter and load releases for the first match.
                  // When filter is "all", just use the first variant —
                  // the modal will never push the user through a second
                  // dialog asking the same question twice.
                  const matchingVariants =
                    state.formatFilter === "all"
                      ? group.variants
                      : group.variants.filter(
                          (variant) =>
                            variant.variant ===
                            state.formatFilter,
                        )
                  const pick =
                    matchingVariants[0] ?? group.variants[0]
                  void loadReleasesForFid(
                    group,
                    pick.id,
                    pick.variant,
                  )
                } else {
                  let id: number | string | undefined
                  // Companion gets the year-augmented label so the saved
                  // YAML mirrors what the picker showed (e.g.,
                  // "Toilet-Bound Hanako-kun (2020)") and so the
                  // typed-id reverse-lookup (which formats the same way
                  // server-side) round-trips identically.
                  let displayName =
                    label === "—" ? "" : label
                  if (state.lookupType === "mal") {
                    id = typedResult.malId
                  } else if (state.lookupType === "anidb") {
                    id = typedResult.aid
                  } else if (state.lookupType === "tvdb") {
                    id = typedResult.tvdbId
                  } else if (state.lookupType === "tmdb") {
                    id = typedResult.movieDbId
                    displayName = typedResult.year
                      ? `${typedResult.title} (${typedResult.year})`
                      : (typedResult.title ?? "")
                  }
                  if (id !== undefined) {
                    // Write number to the primary numeric field, and
                    // the display name to its companion field — never
                    // an object, which would render as "[object Object]"
                    // in NumberWithLookupField (it casts the value as
                    // `number | undefined`).
                    setParam(
                      state.stepId,
                      state.fieldName,
                      id,
                    )
                    if (state.companionNameField) {
                      setParam(
                        state.stepId,
                        state.companionNameField,
                        displayName,
                      )
                    }
                    onClose()
                  }
                }
              }

              return (
                <button
                  type="button"
                  key={label}
                  onClick={handleSelect}
                  className="text-left text-sm px-3 py-2 rounded border border-slate-700 hover:border-blue-500 hover:bg-blue-900/20 text-slate-200 transition-colors"
                >
                  <div className="flex items-baseline gap-2">
                    {keyHint}
                    <span>{label}</span>
                  </div>
                  {japaneseSubtitle && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {japaneseSubtitle}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
    </div>
  )
}
