// AniDB HTTP API response shapes — hand-written from
// https://wiki.anidb.net/HTTP_API_Definition (no OpenAPI exists). Note that
// title `type` is a descriptive string in the actual XML even though the
// docs sometimes refer to numeric IDs; episode `type` IS numeric.
export type AnidbTitleType =
  | "main"
  | "synonym"
  | "short"
  | "official"

// type: 1=regular, 2=special, 3=credit (OP/ED), 4=trailer, 5=parody, 6=other
export type AnidbEpisodeType = 1 | 2 | 3 | 4 | 5 | 6

export type AnidbEpisode = {
  airdate?: string
  epno: string
  length?: number
  titles: { lang: string; value: string }[]
  type: AnidbEpisodeType
}

export type AnidbAnime = {
  aid: number
  episodes: AnidbEpisode[]
  titles: {
    lang: string
    type: AnidbTitleType
    value: string
  }[]
}

// User-facing grouping for the rename command. Each AniDB episode
// type maps to a single category so the user can run one rename per
// type — they're typically named separately (a Specials folder, a
// Credits folder, etc.) and mixing them in one prompt loop confused
// the picker. The mapping is 1:1 with AniDB's `<epno type="N">`:
//   regular  → 1   specials → 2 (S)   credits → 3 (C, OP/ED)
//   trailers → 4   parodies → 5 (P)   others  → 6 (O, alt cuts)
export type AnidbEpisodeCategory =
  | "regular"
  | "specials"
  | "credits"
  | "trailers"
  | "parodies"
  | "others"

const TYPES_BY_CATEGORY: Record<
  AnidbEpisodeCategory,
  AnidbEpisodeType[]
> = {
  regular: [1],
  specials: [2],
  credits: [3],
  trailers: [4],
  parodies: [5],
  others: [6],
}

export const episodeTypesForCategory = (
  category: AnidbEpisodeCategory,
): AnidbEpisodeType[] => TYPES_BY_CATEGORY[category]

// regular and others use the existing index-paired flow (the file at
// position N maps to the Nth episode after sort). Everything else
// requires the length-matched per-file picker because users
// typically have a smaller, partial set of those files and the
// 1:1 index mapping doesn't hold.
export const isPickerCategory = (
  category: AnidbEpisodeCategory,
): boolean =>
  category !== "regular" && category !== "others"

// Display-only letter prefix mirroring AniDB's UI convention: regular
// epnos render as plain numbers, the rest carry an S/C/T/P/O tag.
export const letterPrefixForType = (
  type: AnidbEpisodeType,
): string => {
  switch (type) {
    case 2: {
      return "S"
    }
    case 3: {
      return "C"
    }
    case 4: {
      return "T"
    }
    case 5: {
      return "P"
    }
    case 6: {
      return "O"
    }
    default: {
      return ""
    }
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
const ORDERING_BASE_BY_TYPE: Record<
  AnidbEpisodeType,
  number
> = {
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
  return (
    base + (Number.isFinite(numericPart) ? numericPart : 0)
  )
}

// AniDB rounds reported episode lengths UP, in two precision tiers:
//   - At or below 15 minutes: rounded up to the nearest whole minute
//     (e.g., 12m45s → 13).
//   - 16 minutes and above:    rounded up to the nearest 5 minutes
//     (e.g., 32m45s → 35; 31m → 35; 30m → 30).
//
// A 32-minute file matched against a 35-minute AniDB special isn't
// a 3-minute mismatch — it's exactly what you'd expect once you
// account for the rounding. anidbLengthTolerance + the helpers below
// let the picker rank "within rounding window" matches as 0 delta and
// keep the duration sanity-check warning from screaming on every
// 16+-minute pair.
const ANIDB_ROUNDING_BREAKPOINT_MINUTES = 16

export const anidbLengthTolerance = (
  anidbLength: number,
): number =>
  anidbLength >= ANIDB_ROUNDING_BREAKPOINT_MINUTES ? 5 : 1

// Distance from `fileMinutes` to the nearest edge of the AniDB
// rounding window for `anidbLength`. Returns 0 when the file's
// duration is consistent with what AniDB would have reported (i.e.,
// within the rounding-up window). Always non-negative.
export const effectiveDurationDeltaMinutes = (
  fileMinutes: number,
  anidbLength: number,
): number => {
  const tolerance = anidbLengthTolerance(anidbLength)
  // Round-up window: actual duration in (anidbLength - tolerance,
  // anidbLength]. Files inside this window match exactly.
  const lowerEdgeExclusive = anidbLength - tolerance
  if (
    fileMinutes > lowerEdgeExclusive &&
    fileMinutes <= anidbLength
  ) {
    return 0
  }
  if (fileMinutes <= lowerEdgeExclusive) {
    return lowerEdgeExclusive - fileMinutes + 1
  }
  return fileMinutes - anidbLength
}
