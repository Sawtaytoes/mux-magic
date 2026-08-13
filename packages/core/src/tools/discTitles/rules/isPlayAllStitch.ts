import {
  type DiscTitleRule,
  getIsPlaylistTitle,
} from "../discTitleAnalysis.js"

/**
 * A playlist that is its siblings played back to back.
 *
 * A "Play All" title stitches the individual parts together: its segment
 * map is the union of theirs and its runtime is roughly their sum. The
 * parts carry the real boundaries, so the stitch is redundant — provided
 * the parts really are all present.
 *
 * ⚠️ **Deliberate deviation from the plan, stated rather than buried.**
 * The plan says "keep the parts, drop the stitch". This proposes
 * `inspect`, not `discard`, for two reasons:
 *
 *  1. No backup in the current corpus exercises it (`validatedAgainst` is
 *     empty), so it is a hypothesis, and the standing instruction where
 *     signals disagree is to default to keeping.
 *  2. On anime discs the relationship inverts — the Play All is often the
 *     ONLY chaptered copy and the individual "episodes" turn out to carry
 *     just the commentary audio. Dropping the stitch there would discard
 *     the thing actually wanted. The sketch defers anime Play-All handling
 *     entirely, and quietly discarding stitches would pre-empt that
 *     decision on exactly the discs where it is most likely wrong.
 *
 * Flip it to `discard` once a real Play-All backup has been run through
 * the analyser and the parts confirmed complete.
 */
const runtimeTolerance = 0.02
// A 10-second two-segment stub technically "covers its parts" — Desk Set's
// 00012.mpls does exactly that over two 7-second fragments. Calling that a
// Play All is noise, so the rule only speaks about titles long enough for
// the question to matter.
const minimumDurationSeconds = 10 * 60

export const isPlayAllStitch: DiscTitleRule = {
  description:
    "A playlist whose segments and runtime are the sum of sibling titles — a Play All stitch over its own parts.",
  evaluate: ({ graph }) =>
    ((candidateTitles) =>
      candidateTitles.flatMap((stitchTitle) =>
        ((parts) =>
          parts.length > 1 &&
          Math.abs(
            parts.reduce(
              (total, part) =>
                total + (part.durationSeconds ?? 0),
              0,
            ) - (stitchTitle.durationSeconds ?? 0),
          ) <=
            (stitchTitle.durationSeconds ?? 0) *
              runtimeTolerance
            ? [
                {
                  confidence: "low" as const,
                  disposition: "inspect" as const,
                  reason: `${stitchTitle.sourceFileName} (${stitchTitle.durationText}) covers the segments of ${parts.length} sibling titles (${parts
                    .map((part) => part.sourceFileName)
                    .join(
                      ", ",
                    )}) and matches their combined runtime — a Play All stitch. Confirm whether the parts or the stitch is the one to keep.`,
                  ruleName: isPlayAllStitch.name,
                  titleIndices: [stitchTitle.titleIndex],
                },
              ]
            : [])(
          graph.titles.filter(
            (partTitle) =>
              partTitle.titleIndex !==
                stitchTitle.titleIndex &&
              partTitle.segmentMap.length > 0 &&
              partTitle.segmentMap.length <
                stitchTitle.segmentMap.length &&
              partTitle.segmentMap.every((segment) =>
                stitchTitle.segmentMap.includes(segment),
              ),
          ),
        ),
      ))(
      graph.titles
        .filter(getIsPlaylistTitle)
        .filter(
          (title) =>
            !title.isSegmentMapTruncated &&
            title.segmentMap.length > 1 &&
            (title.durationSeconds ?? 0) >=
              minimumDurationSeconds,
        ),
    ),
  name: "isPlayAllStitch",
  validatedAgainst: [],
}
