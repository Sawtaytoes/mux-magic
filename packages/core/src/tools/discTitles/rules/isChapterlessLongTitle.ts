import type { DiscTitleRule } from "../discTitleAnalysis.js"

/**
 * A feature-length title with no chapter marks and no chaptered twin.
 *
 * The owner's rule of thumb:
 *
 * > "Does it have chapters? If it's a large file without chapters, then
 * > it's probably useless."
 *
 * ⚠️ Note **large**. The sketch generalised this to "long", and against
 * real backups that generalisation is dangerous: the Troy bonus disc's
 * genuine featurettes are 1–17 minute `.m2ts` titles with no chapters at
 * all, and a "long chapterless → discard" rule would propose throwing away
 * 20-odd real extras. So the floor here is FEATURE length, and the rule
 * deliberately fires on very little in the current corpus — the
 * chapterless things it would otherwise catch are already caught, with
 * higher confidence and a better reason, by `isChapterlessTwin`.
 *
 * Medium confidence, never high: a chapterless long title is the classic
 * studio anti-rip decoy, but it is not guaranteed to be junk.
 */
const minimumDurationSeconds = 45 * 60

export const isChapterlessLongTitle: DiscTitleRule = {
  description:
    "A feature-length title with no chapter marks and no chaptered sibling — usually playlist padding or an anti-rip decoy.",
  evaluate: ({ clusters, graph }) =>
    graph.titles
      .filter(
        (title) =>
          (title.chapterCount === null ||
            title.chapterCount <= 1) &&
          (title.durationSeconds ?? 0) >=
            minimumDurationSeconds &&
          // Leave the twin case to isChapterlessTwin, which can name the
          // sibling it duplicates and is far more certain.
          !clusters.some(
            (cluster) =>
              cluster.titleIndices.includes(
                title.titleIndex,
              ) &&
              cluster.titleIndices.length > 1 &&
              !cluster.isSegmentMapTruncated,
          ),
      )
      .map((title) => ({
        confidence: "medium" as const,
        disposition: "discard" as const,
        reason: `${title.sourceFileName}: ${title.durationText} with no chapter marks and no chaptered sibling — probably playlist padding or an anti-rip decoy.`,
        ruleName: isChapterlessLongTitle.name,
        titleIndices: [title.titleIndex],
      })),
  name: "isChapterlessLongTitle",
  validatedAgainst: [],
}
