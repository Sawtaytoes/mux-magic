import {
  from,
  map,
  mergeMap,
  type Observable,
  of,
} from "rxjs"

import { logAndSwallow } from "./logAndSwallow.js"
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

// Returns the English series title when TVDB has one on file, falling
// back to the canonical /series/{id} name otherwise. The two-step lookup
// matches the pickEnglishName logic in mapTvdbSearchResults so the
// lookup modal and the typed-id reverse-lookup agree on which name to
// surface for a given series.
export const lookupTvdbById = (
  tvdbId: number,
): Observable<{ name: string } | null> =>
  from(getTvdbFetchClient()).pipe(
    mergeMap((tvdbFetchClient) =>
      from(
        tvdbFetchClient.GET(
          "/series/{id}/translations/{language}",
          {
            params: {
              path: { id: tvdbId, language: "eng" },
            },
          },
        ),
      ).pipe(
        mergeMap(({ data: translationData }) => {
          const englishName =
            translationData?.data?.name ?? ""
          if (englishName) {
            return of({ name: englishName })
          }
          return from(
            tvdbFetchClient.GET("/series/{id}", {
              params: {
                path: { id: tvdbId },
              },
            }),
          ).pipe(
            map(({ data }) => {
              const name = data?.data?.name ?? ""
              return name ? { name } : null
            }),
          )
        }),
      ),
    ),
    logAndSwallow(lookupTvdbById),
  )
