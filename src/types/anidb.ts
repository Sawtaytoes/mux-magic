// AniDB HTTP API response shapes — hand-written from
// https://wiki.anidb.net/HTTP_API_Definition (no OpenAPI exists). Note that
// title `type` is a descriptive string in the actual XML even though the
// docs sometimes refer to numeric IDs; episode `type` IS numeric.
export type AnidbTitleType = "main" | "synonym" | "short" | "official"

// type: 1=regular, 2=special, 3=credit (OP/ED), 4=trailer, 5=parody, 6=other
export type AnidbEpisodeType = 1 | 2 | 3 | 4 | 5 | 6

export type AnidbEpisode = {
  airdate?: string,
  epno: string,
  length?: number,
  titles: { lang: string, value: string }[],
  type: AnidbEpisodeType,
}

export type AnidbAnime = {
  aid: number,
  episodes: AnidbEpisode[],
  titles: { lang: string, type: AnidbTitleType, value: string }[],
}

// User-facing grouping for the rename command. AniDB has six episode
// types but most users only think in three buckets:
//   - regular  → type=1 (the main run)
//   - specials → type=2 (S), 3 (C, OP/ED songs), 4 (T, trailers), 5 (P, parodies)
//   - others   → type=6 (O, alternate cuts like director's-cut episodes)
export type AnidbEpisodeCategory = "regular" | "specials" | "others"

const TYPES_BY_CATEGORY: Record<AnidbEpisodeCategory, AnidbEpisodeType[]> = {
  regular: [1],
  specials: [2, 3, 4, 5],
  others: [6],
}

export const episodeTypesForCategory = (
  category: AnidbEpisodeCategory,
): AnidbEpisodeType[] => TYPES_BY_CATEGORY[category]

// Display-only letter prefix mirroring AniDB's UI convention: regular
// epnos render as plain numbers, the rest carry an S/C/T/P/O tag.
export const letterPrefixForType = (type: AnidbEpisodeType): string => {
  switch (type) {
    case 2: { return "S" }
    case 3: { return "C" }
    case 4: { return "T" }
    case 5: { return "P" }
    case 6: { return "O" }
    default: { return "" }
  }
}

// Synthesize a global numeric ordering for an epno + type pair.
// AniDB's XML stores epno as a letter-prefixed string ("S1", "C5",
// "O13") for non-regular types — Number("S1") is NaN, so a naive
// sort by Number(epno) shuffles those types unpredictably. We
// reconstruct the ordering using the user's documented hundreds-digit
// scheme: specials=1xx, trailers=2xx, songs=3xx, others=4xx,
// parody=5xx. This puts "S1, S2, ..., T1, T2, ..., C1, C2, ..." in
// the order users expect when listing specials together.
const ORDERING_BASE_BY_TYPE: Record<AnidbEpisodeType, number> = {
  1: 0,
  2: 100,
  4: 200,
  3: 300,
  6: 400,
  5: 500,
}

export const epnoOrderingValue = (
  type: AnidbEpisodeType,
  epno: string,
): number => {
  const numericPart = Number(epno.replace(/[^0-9]/g, ""))
  const base = ORDERING_BASE_BY_TYPE[type] ?? 0
  return base + (Number.isFinite(numericPart) ? numericPart : 0)
}
