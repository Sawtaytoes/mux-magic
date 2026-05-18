import {
  getIsSimilarTimecode,
  type TimecodeDeviation,
} from "../tools/getSpecialFeatureFromTimecode.js"
import type { Cut } from "../tools/parseSpecialFeatures.js"

// Files shorter than this never get the main-feature fallback rename.
// 30 min is a generous floor — typical movie cuts exceed it by a wide
// margin, while typical extras (clips, image galleries, trailers,
// short featurettes) come in well under. Surfaced as a constant so it's
// easy to retune when a real-world false-positive shows up.
export const MAIN_FEATURE_MIN_DURATION_SECONDS = 30 * 60

export const timecodeToSeconds = (
  timecode: string,
): number => {
  const parts = timecode
    .split(":")
    .map((segment) => Number(segment) || 0)
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

// Movie-cut matching uses a wider tolerance window than extras matching.
// Full-feature rips routinely drift 5–10 seconds from DVDCompare's
// published runtime (encoder padding, leading/trailing logos, slightly
// different chapter handling), which the default per-extra padding of 2
// would reject. Cuts on a single release are minutes apart, so a 15-sec
// window won't false-positive across editions but does catch typical
// rip variance.
const CUT_TIMECODE_PADDING_FALLBACK = 15

export const findMatchingCut = (
  cuts: Cut[],
  fileTimecode: string,
  deviation: TimecodeDeviation,
): Cut | null => {
  const cutDeviation: TimecodeDeviation = {
    fixedOffset: deviation.fixedOffset,
    timecodePaddingAmount: Math.max(
      deviation.timecodePaddingAmount ?? 0,
      CUT_TIMECODE_PADDING_FALLBACK,
    ),
  }
  return (
    cuts.find(
      (cut) =>
        cut.timecode != null &&
        getIsSimilarTimecode(
          fileTimecode,
          cut.timecode,
          cutDeviation,
        ),
    ) ?? null
  )
}
