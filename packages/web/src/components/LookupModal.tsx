import { useAtom } from "jotai"
import { useEffect, useRef } from "react"
import { lookupModalAtom } from "../state/uiAtoms"
import type {
  LookupGroup,
  LookupRelease,
  LookupSearchResult,
  LookupState,
  LookupType,
} from "../types"

// ─── Constants ────────────────────────────────────────────────────────────────

const LOOKUP_TITLES: Record<LookupType, string> = {
  mal: "Look up MAL ID",
  anidb: "Look up AniDB ID",
  tvdb: "Look up TVDB ID",
  tmdb: "Look up TMDB ID",
  dvdcompare: "Look up DVDCompare Film ID",
}

// ─── API calls ────────────────────────────────────────────────────────────────

const SEARCH_ENDPOINTS: Record<LookupType, string> = {
  mal: "/queries/searchMal",
  anidb: "/queries/searchAnidb",
  tvdb: "/queries/searchTvdb",
  tmdb: "/queries/searchMovieDb",
  dvdcompare: "/queries/searchDvdCompare",
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
    return {
      results: data.results ?? [],
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

// ─── Bridge: write selection back to the legacy step editor ──────────────────

const applySimpleSelection = (
  state: LookupState,
  id: number | string,
  displayName: string,
) => {
  const bridge = window.mediaTools as
    | Record<string, unknown>
    | undefined
  if (typeof bridge?.applyLookupSelection === "function") {
    ;(
      bridge.applyLookupSelection as (
        stepId: string,
        fieldName: string,
        id: number | string,
        displayName: string,
      ) => void
    )(state.stepId, state.fieldName, id, displayName)
  }
}

const applyDvdCompareSelection = (
  state: LookupState,
  hash: string | number,
  label: string,
) => {
  const bridge = window.mediaTools as
    | Record<string, unknown>
    | undefined
  if (
    typeof bridge?.applyDvdCompareSelection === "function"
  ) {
    ;(
      bridge.applyDvdCompareSelection as (
        stepId: string,
        group: LookupGroup | null,
        selectedFid: string | null,
        selectedVariant: string | null,
        hash: string | number,
        label: string,
      ) => void
    )(
      state.stepId,
      state.selectedGroup,
      state.selectedFid,
      state.selectedVariant,
      hash,
      label,
    )
  }
}

// ─── Search stage ─────────────────────────────────────────────────────────────

const SearchStage = ({
  state,
  onUpdate,
  onClose,
}: {
  state: LookupState
  onUpdate: (patch: Partial<LookupState>) => void
  onClose: () => void
}) => {
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
            state.results as Array<{
              groups?: LookupGroup[]
            }>
          )
            .map((group) => ({
              ...group,
              groups: (group.groups ?? []).filter((grp) =>
                grp.variants?.some(
                  (variant) =>
                    variant.variant === state.formatFilter,
                ),
              ),
            }))
            .filter(
              (group) => (group.groups?.length ?? 0) > 0,
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
                    id = r.malId
                    displayName = r.name ?? ""
                  } else if (state.lookupType === "anidb") {
                    id = r.aid
                    displayName = r.name ?? ""
                  } else if (state.lookupType === "tvdb") {
                    id = r.tvdbId
                    displayName = r.name ?? ""
                  } else if (state.lookupType === "tmdb") {
                    id = r.movieDbId
                    displayName = r.year
                      ? `${r.title} (${r.year})`
                      : (r.title ?? "")
                  }
                  if (id !== undefined) {
                    applySimpleSelection(
                      state,
                      id,
                      displayName,
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

// ─── Variant stage (DVDCompare only) ─────────────────────────────────────────

const VariantStage = ({
  state,
  onUpdate,
  onClose,
}: {
  state: LookupState
  onUpdate: (patch: Partial<LookupState>) => void
  onClose: () => void
}) => {
  const group = state.selectedGroup
  if (!group) return null

  const selectVariant = (
    variantId: string,
    variant: string,
  ) => {
    onUpdate({
      selectedFid: variantId,
      selectedVariant: variant,
      stage: "release",
      releases: null,
      loading: true,
    })
    fetchReleases(variantId).then(
      ({ releases, debug, error }) => {
        if (releases.length === 1) {
          applyDvdCompareSelection(
            state,
            releases[0].hash,
            releases[0].label,
          )
          onClose()
        } else {
          onUpdate({
            releases,
            releasesDebug: debug,
            releasesError: error,
            loading: false,
          })
        }
      },
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-slate-400 text-xs">
        Select a variant for "{group.baseTitle}":
      </p>
      {group.variants.map((variant, index) => (
        <button
          type="button"
          key={variant.id}
          onClick={() =>
            selectVariant(variant.id, variant.variant)
          }
          className="text-left text-sm px-3 py-2 rounded border border-slate-700 hover:border-blue-500 hover:bg-blue-900/20 text-slate-200 transition-colors"
        >
          <span className="text-xs font-mono bg-slate-700 px-1 rounded mr-2">
            {index + 1}
          </span>
          {variant.variant}
        </button>
      ))}
    </div>
  )
}

// ─── Release stage (DVDCompare only) ─────────────────────────────────────────

const ReleaseStage = ({
  state,
  onClose,
}: {
  state: LookupState
  onClose: () => void
}) => {
  if (state.loading) {
    return (
      <p className="text-slate-500 text-sm text-center py-4">
        Loading releases…
      </p>
    )
  }

  if (state.releasesError) {
    return (
      <p className="text-rose-400 text-xs">
        {state.releasesError}
      </p>
    )
  }

  const releases = state.releases ?? []

  if (releases.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-4">
        No releases found.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-slate-400 text-xs">
        Select a release:
      </p>
      {releases.map((release, index) => (
        <button
          type="button"
          key={String(release.hash)}
          onClick={() => {
            applyDvdCompareSelection(
              state,
              release.hash,
              release.label,
            )
            onClose()
          }}
          className="text-left text-sm px-3 py-2 rounded border border-slate-700 hover:border-blue-500 hover:bg-blue-900/20 text-slate-200 transition-colors"
        >
          <span className="text-xs font-mono bg-slate-700 px-1 rounded mr-2">
            {index + 1}
          </span>
          {release.label}
        </button>
      ))}
    </div>
  )
}

// ─── LookupModal ──────────────────────────────────────────────────────────────

export const LookupModal = () => {
  const [state, setState] = useAtom(lookupModalAtom)
  const stateRef = useRef(state)
  stateRef.current = state

  const update = (patch: Partial<LookupState>) => {
    setState((prev) =>
      prev ? { ...prev, ...patch } : prev,
    )
  }

  const close = () => setState(null)

  // Keyboard: Esc closes; 1-9 select the active option in the current stage.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current
      if (!current) return
      if (event.key === "Escape") {
        setState(null)
        return
      }
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return
      const digit = parseInt(event.key, 10)
      if (Number.isNaN(digit)) return
      event.preventDefault()
      const index = digit - 1
      // Dispatch a click on the nth visible option button inside the modal.
      const modal = document.getElementById("lookup-modal")
      if (!modal) return
      const buttons = Array.from(
        modal.querySelectorAll<HTMLButtonElement>("button"),
      ).filter(
        (btn) => btn.dataset.optionIndex !== undefined,
      )
      buttons[index]?.click()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () =>
      document.removeEventListener("keydown", handleKeyDown)
  }, [setState])

  if (!state) return null

  const title = LOOKUP_TITLES[state.lookupType] ?? "Lookup"
  const canGoBack =
    state.stage === "variant" || state.stage === "release"

  const goBack = () => {
    if (state.stage === "release") {
      update({ stage: "variant" })
    } else if (state.stage === "variant") {
      update({ stage: "search", selectedGroup: null })
    }
  }

  return (
    <div
      id="lookup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="none"
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") close()
      }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[85dvh]">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 shrink-0">
          {canGoBack && (
            <button
              type="button"
              id="lookup-back-btn"
              onClick={goBack}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded border border-slate-700 hover:border-slate-500 mr-1"
            >
              ← Back
            </button>
          )}
          <h2
            id="lookup-title"
            className="text-sm font-semibold text-slate-100 flex-1"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            className="text-slate-400 hover:text-white text-base leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          id="lookup-body"
          className="flex-1 overflow-y-auto p-4 min-h-0"
        >
          {state.stage === "search" && (
            <SearchStage
              state={state}
              onUpdate={update}
              onClose={close}
            />
          )}
          {state.stage === "variant" && (
            <VariantStage
              state={state}
              onUpdate={update}
              onClose={close}
            />
          )}
          {state.stage === "release" && (
            <ReleaseStage state={state} onClose={close} />
          )}
        </div>
      </div>
    </div>
  )
}
