import { getSegmentOverlapRatio } from "../clusterTitlesBySegmentMap.js"
import {
  type DiscTitleRule,
  getIsPlaylistTitle,
} from "../discTitleAnalysis.js"

/**
 * Two feature-length playlists that share most segments but not all.
 *
 * Where `isTrackSetVariant` finds one video wearing several track sets,
 * this finds genuinely different cuts — theatrical vs extended, or a
 * censored/regional variant. Both get kept, and the SEGMENT DIFF goes in
 * the reason, because "these two differ only in segment 6 vs 5" is exactly
 * what lets the owner confirm in seconds instead of scrubbing two films.
 *
 * Validated against `[BACKUP] THE OUTFIT - Blu-ray`:
 *
 *   00011.mpls  12ch  1:41:10  31.1 GB   segments 4,6
 *   00002.mpls  12ch  1:43:07  31.7 GB   segments 4,5
 *
 * Shared body (segment 4), differing tail (6 vs 5), ~2 minutes apart. This
 * is also the shape the sketch's deferred studio patterns take — Disney
 * localised-text sets and Ghibli sides are both "full-length siblings
 * differing in a few segments". Those patterns stay OUT of the registry
 * until a Disney/Ghibli backup has actually been run through the analyser;
 * this rule finds the shape and keeps both, which is the safe answer for
 * all three cases.
 *
 * The explicit instruction for ambiguity here is to keep everything
 * plausible: the backup is already paid for, and disk is cheaper than
 * re-ripping a disc that may since have gone back in a box.
 */
const minimumDurationSeconds = 45 * 60
const minimumOverlapRatio = 0.3

export const isDistinctCut: DiscTitleRule = {
  description:
    "Feature-length playlists sharing most segments but not all — different cuts, keep both and show the diff.",
  evaluate: ({ graph }) =>
    ((featurePlaylists) =>
      featurePlaylists.flatMap((leftTitle, leftPosition) =>
        featurePlaylists
          .slice(leftPosition + 1)
          .filter(
            (rightTitle) =>
              leftTitle.segmentMapText !==
                rightTitle.segmentMapText &&
              getSegmentOverlapRatio({
                leftSegments: leftTitle.segmentMap,
                rightSegments: rightTitle.segmentMap,
              }) >= minimumOverlapRatio,
          )
          .map((rightTitle) => ({
            confidence: "medium" as const,
            disposition: "keep" as const,
            reason: `${leftTitle.sourceFileName} (${leftTitle.durationText}, segments ${leftTitle.segmentMapText}) and ${rightTitle.sourceFileName} (${rightTitle.durationText}, segments ${rightTitle.segmentMapText}) share segments but differ — different cuts, not duplicates. Keeping both.`,
            ruleName: isDistinctCut.name,
            titleIndices: [
              leftTitle.titleIndex,
              rightTitle.titleIndex,
            ],
          })),
      ))(
      graph.titles
        .filter(getIsPlaylistTitle)
        .filter(
          (title) =>
            (title.durationSeconds ?? 0) >=
              minimumDurationSeconds &&
            !title.isSegmentMapTruncated &&
            title.chapterCount !== null &&
            title.chapterCount > 1,
        ),
    ),
  name: "isDistinctCut",
  validatedAgainst: ["[BACKUP] THE OUTFIT - Blu-ray"],
}
