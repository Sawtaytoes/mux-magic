import { useEffect, useRef } from "react"
import type {
  LookupGroup,
  LookupRelease,
  LookupSearchResult,
  LookupState,
  LookupType,
} from "../../components/LookupModal/types"
import { useBuilderActions } from "../../hooks/useBuilderActions"

const SEARCH_ENDPOINTS: Record<LookupType, string> = {
  mal: "/queries/searchMal",
  anidb: "/queries/searchAnidb",
  tvdb: "/queries/searchTvdb",
  tmdb: "/queries/searchMovieDb",
  dvdcompare: "/queries/searchDvdCompare",
}

type DvdCompareApiResult = {
  baseTitle: string
  id: number
  variant: string
  year: string
}

const groupDvdCompareResults = (
  flat: DvdCompareApiResult[],
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
  error: string | null
}> => {
  try {
    const resp = await fetch(SEARCH_ENDPOINTS[lookupType], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchTerm }),
    })
    const data = (await resp.json()) as {
      results?: LookupSearchResult[]
      error?: string
    }
    const rawResults = data.results ?? []
    const results =
      lookupType === "dvdcompare"
        ? (groupDvdCompareResults(
            rawResults as unknown as DvdCompareApiResult[],
          ) as unknown as LookupSearchResult[])
        : rawResults
    return {
      results,
      error: data.error ?? null,
    }
  } catch (error) {
    return {
      results: [],
      error:
        error instanceof Error
          ? error.message
          : String(error),
    }
  }
}

const fetchReleases = async (
  dvdCompareId: string,
): Promise<{
  releases: LookupRelease[]
  debug: unknown
  error: string | null
}> => {
  try {
    const resp = await fetch(
      "/queries/listDvdCompareReleases",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dvdCompareId }),
      },
    )
    const data = (await resp.json()) as {
      releases?: LookupRelease[]
      debug?: unknown
      error?: string
    }
    return {
      releases: data.releases ?? [],
      debug: data.debug ?? null,
      error: data.error ?? null,
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

  const runSearch = async () => {
    const term = state.searchTerm.trim()
    if (!term) return
    onUpdate({ loading: true, searchError: null })
    const { results, error } = await fetchSearch(
      state.lookupType,
      term,
    )
    onUpdate({
      loading: false,
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
            state.loading || !state.searchTerm.trim()
          }
          className="text-xs bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white px-3 py-1.5 rounded font-medium"
        >
          {state.loading ? "Searching…" : "Search"}
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
                  title?: string
                }
              const label =
                state.lookupType === "tmdb"
                  ? typedResult.year
                    ? `${typedResult.title} (${typedResult.year})`
                    : (typedResult.title ?? "—")
                  : (typedResult.name ??
                    typedResult.baseTitle ??
                    "—")
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
                  if (group.variants.length === 1) {
                    onUpdate({
                      selectedGroup: group,
                      selectedFid: group.variants[0].id,
                      selectedVariant:
                        group.variants[0].variant,
                      stage: "release",
                      loading: true,
                    })
                    fetchReleases(
                      group.variants[0].id,
                    ).then(({ releases, debug, error }) => {
                      onUpdate({
                        releases,
                        releasesDebug: debug,
                        releasesError: error,
                        loading: false,
                      })
                    })
                  } else {
                    onUpdate({
                      selectedGroup: group,
                      stage: "variant",
                    })
                  }
                } else {
                  let id: number | string | undefined
                  let displayName = ""
                  if (state.lookupType === "mal") {
                    id = typedResult.malId
                    displayName = typedResult.name ?? ""
                  } else if (state.lookupType === "anidb") {
                    id = typedResult.aid
                    displayName = typedResult.name ?? ""
                  } else if (state.lookupType === "tvdb") {
                    id = typedResult.tvdbId
                    displayName = typedResult.name ?? ""
                  } else if (state.lookupType === "tmdb") {
                    id = typedResult.movieDbId
                    displayName = typedResult.year
                      ? `${typedResult.title} (${typedResult.year})`
                      : (typedResult.title ?? "")
                  }
                  if (id !== undefined) {
                    setParam(
                      state.stepId,
                      state.fieldName,
                      { id, name: displayName },
                    )
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
                  {keyHint}
                  {label}
                </button>
              )
            })}
          </div>
        )}
    </div>
  )
}
