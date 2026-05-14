import { logAndSwallowPipelineError } from "@mux-magic/tools"
import { from, map, type Observable } from "rxjs"

// Backed by Jikan v4 (https://docs.api.jikan.moe), the de-facto unofficial
// MAL API. We picked Jikan over mal-scraper because:
//   - search returns title_english + title (romaji) in one request, so we
//     can show "Toilet-Bound Hanako-kun" with "Jibaku Shounen Hanako-kun"
//     as a subtitle without per-result hydration fan-out.
//   - aired.prop.from.year gives us a release year directly, removing the
//     "1998 - 1999"-style range parsing the mal-scraper path required.
//   - public, no auth, ~3 req/s rate limit (plenty for an interactive
//     picker; the lag of a few hours behind MAL itself is irrelevant for
//     renaming workloads where the canonical romaji has been stable for
//     years).
//
// Display rule across the codebase: prefer title_english, falling back to
// title (romaji). The romaji `title` is exposed separately as
// `nameJapanese` so the UI can render it as a gray subtitle for
// disambiguation when the user knows the show by its original Japanese
// name. We don't surface title_japanese (the kanji form) — users
// recognize "Jibaku Shounen Hanako-kun" but not "地縛少年花子くん".

const JIKAN_BASE = "https://api.jikan.moe/v4"

export type MalResult = {
  airDate?: string
  imageUrl?: string
  malId: number
  mediaType?: string
  name: string
  nameJapanese?: string
  year?: string
}

// Subset of Jikan's /anime response — only the fields we read. Defining it
// locally means the mapping helper can be tested with synthetic inputs.
export type JikanAnimeRow = {
  mal_id: number
  title?: string
  title_english?: string | null
  title_japanese?: string | null
  type?: string | null
  aired?: {
    from?: string | null
    string?: string | null
    prop?: {
      from?: { year?: number | null } | null
    } | null
  }
  images?: {
    jpg?: {
      image_url?: string | null
      small_image_url?: string | null
    }
  }
}

const pickDisplayName = (row: JikanAnimeRow): string =>
  row.title_english?.trim() ||
  row.title?.trim() ||
  row.title_japanese?.trim() ||
  ""

const pickYear = (
  row: JikanAnimeRow,
): string | undefined => {
  const propYear = row.aired?.prop?.from?.year
  if (typeof propYear === "number" && propYear > 0)
    return String(propYear)
  const fromMatch = row.aired?.from?.match(/^(\d{4})/)
  return fromMatch?.[1]
}

export const mapJikanSearchResults = (
  rows: JikanAnimeRow[] | null | undefined,
): MalResult[] =>
  (rows ?? [])
    .map((row) => {
      const name = pickDisplayName(row)
      const romaji = row.title?.trim() ?? ""
      // Suppress the romaji subtitle when it'd just duplicate the
      // primary name (happens when title_english was empty so we
      // already chose the romaji as the primary).
      const nameJapanese =
        romaji && romaji !== name ? romaji : undefined
      return {
        airDate: row.aired?.string ?? undefined,
        imageUrl:
          row.images?.jpg?.small_image_url ??
          row.images?.jpg?.image_url ??
          undefined,
        malId: row.mal_id,
        mediaType: row.type ?? undefined,
        name,
        nameJapanese,
        year: pickYear(row),
      }
    })
    .filter((result) => result.malId > 0 && result.name)

export const searchMal = (
  searchTerm: string,
): Observable<MalResult[]> =>
  from(
    fetch(
      `${JIKAN_BASE}/anime?q=${encodeURIComponent(searchTerm)}&limit=10`,
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Jikan search failed (${response.status})`,
        )
      }
      const payload = (await response.json()) as {
        data?: JikanAnimeRow[]
      }
      return mapJikanSearchResults(payload.data)
    }),
  )

export type MalLookupResult = {
  name: string
  nameJapanese?: string
  year?: string
}

export const lookupMalById = (
  malId: number,
): Observable<MalLookupResult | null> =>
  from(
    fetch(`${JIKAN_BASE}/anime/${malId}`).then(
      async (response) => {
        if (!response.ok) return null
        const payload = (await response.json()) as {
          data?: JikanAnimeRow
        }
        const row = payload.data
        if (!row) return null
        const name = pickDisplayName(row)
        if (!name) return null
        const romaji = row.title?.trim() ?? ""
        return {
          name,
          nameJapanese:
            romaji && romaji !== name ? romaji : undefined,
          year: pickYear(row),
        } satisfies MalLookupResult
      },
    ),
  ).pipe(
    map((result) => result),
    logAndSwallowPipelineError(lookupMalById),
  )
