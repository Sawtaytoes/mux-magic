import type { AnidbEpisode } from "../types/anidb.js"

// Some AniDB anime entries (OVAs and movies, especially) ship the
// same content twice in the episodes array: once as a single
// "Complete" listing and again broken into "Part 1 of 2" / "Part 2 of
// 2" entries. Index-pairing assumes the user has one file per AniDB
// entry, but with these duplicate listings the pairing depends on
// what the user actually has on disk:
//
//   - 1 file at full length  → keep the Complete entry, drop Parts
//   - N files at partial length → keep Parts, drop Complete
//
// The rename flow can't guess that. detectMovieFormatVariants
// surfaces the ambiguity so the caller can prompt for a choice; if
// no parts pattern is present (the typical TV-series case), it
// returns null and the flow proceeds untouched.

export type MovieFormatVariants = {
  complete: AnidbEpisode[]
  parts: AnidbEpisode[]
}

// Title patterns indicating a part-of-N entry. Covers AniDB's common
// renderings: "Part 1 of 2", "Part 1/2", "Part 1". The /i flag
// matches "part", "Part", "PART".
const PARTS_TITLE_PATTERN = /\bpart\s*\d+\b/i

const titleMatchesParts = (episode: AnidbEpisode): boolean => (
  episode.titles.some((title) => PARTS_TITLE_PATTERN.test(title.value))
)

export const detectMovieFormatVariants = (
  episodes: AnidbEpisode[],
): MovieFormatVariants | null => {
  const parts: AnidbEpisode[] = []
  const complete: AnidbEpisode[] = []
  for (const episode of episodes) {
    if (titleMatchesParts(episode)) {
      parts.push(episode)
    } else {
      complete.push(episode)
    }
  }
  // We only signal ambiguity when both subsets are non-empty — a list
  // of Part-only or Complete-only entries isn't an ambiguity, the
  // existing index pairing handles it. We also require parts.length
  // >= 2 because a single "Part 1" entry is more likely a stylistic
  // title choice than an actual part-of-N decomposition.
  if (complete.length === 0 || parts.length < 2) {
    return null
  }
  return { complete, parts }
}
