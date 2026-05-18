import { logAndSwallowPipelineError } from "@mux-magic/tools"
import { from, map, mergeMap, type Observable } from "rxjs"
import { getTvdbFetchClient } from "./tvdbApi.js"

export type TvdbResult = {
  imageUrl?: string
  name: string
  status?: string
  tvdbId: number
  year?: string
}

// Subset of TVDB's SearchResult — only the fields we read. Defined locally
// so the mapping helper can be tested with synthetic inputs without
// importing the generated openapi types. translations is keyed by ISO
// 639-2/B language code (e.g. eng, jpn). name_translated is whichever
// translation TVDB chose to surface alongside the canonical name.
export type TvdbRawResult = {
  image_url?: string
  name?: string
  name_translated?: string
  status?: string
  translations?: Record<string, string>
  tvdb_id?: string
  year?: string
}

// Prefer the English translation when one is available so series whose
// canonical name is non-Latin (e.g. Pokemon's "ポケットモンスター") still
// surface in the lookup modal as "Pokémon". Falls back to whichever
// translated name TVDB pre-selected, then the canonical name.
const pickEnglishName = (entry: TvdbRawResult): string =>
  entry.translations?.eng ??
  entry.name_translated ??
  entry.name ??
  ""

export const mapTvdbSearchResults = (
  rawData: TvdbRawResult[] | null | undefined,
): TvdbResult[] =>
  (rawData ?? [])
    .map((entry) => ({
      imageUrl: entry.image_url,
      name: pickEnglishName(entry),
      status: entry.status,
      tvdbId: Number(entry.tvdb_id),
      year: entry.year,
    }))
    .filter((result) => result.tvdbId > 0 && result.name)

export const searchTvdb = (
  searchTerm: string,
): Observable<TvdbResult[]> =>
  from(getTvdbFetchClient()).pipe(
    mergeMap((tvdbFetchClient) =>
      from(
        tvdbFetchClient.GET("/search", {
          params: {
            query: {
              query: searchTerm,
              type: "series",
            },
          },
        }),
      ),
    ),
    map(({ data }) =>
      mapTvdbSearchResults(
        data?.data as TvdbRawResult[] | undefined,
      ),
    ),
  )

// TVDB exposes `year` directly on the series record and `firstAired`
// on extended fetches. We pull either to surface "Show (Year)" in
// reverse-lookup so saved YAML matches the picker.
const extractYear = (
  raw: { year?: string; firstAired?: string } | undefined,
): string | undefined => {
  if (!raw) return undefined
  if (raw.year && /^\d{4}/.test(raw.year))
    return raw.year.slice(0, 4)
  const fromAired = raw.firstAired?.match(/^(\d{4})/)
  return fromAired?.[1]
}

// Returns the English series title when TVDB has one on file, falling
// back to the canonical /series/{id} name otherwise. The two-step lookup
// matches the pickEnglishName logic in mapTvdbSearchResults so the
// lookup modal and the typed-id reverse-lookup agree on which name to
// surface for a given series. Always fetches /series/{id} to pull `year`,
// even when the English translation alone provided the name.
export const lookupTvdbById = (
  tvdbId: number,
): Observable<{
  name: string
  year?: string
} | null> =>
  from(getTvdbFetchClient()).pipe(
    mergeMap((tvdbFetchClient) =>
      from(
        Promise.all([
          tvdbFetchClient.GET(
            "/series/{id}/translations/{language}",
            {
              params: {
                path: { id: tvdbId, language: "eng" },
              },
            },
          ),
          tvdbFetchClient.GET("/series/{id}", {
            params: { path: { id: tvdbId } },
          }),
        ]),
      ).pipe(
        map(([translationResponse, seriesResponse]) => {
          const englishName =
            translationResponse.data?.data?.name ?? ""
          const seriesData = seriesResponse.data?.data as
            | {
                name?: string
                year?: string
                firstAired?: string
              }
            | undefined
          const name = englishName || seriesData?.name || ""
          if (!name) return null
          return { name, year: extractYear(seriesData) }
        }),
      ),
    ),
    logAndSwallowPipelineError(lookupTvdbById),
  )
