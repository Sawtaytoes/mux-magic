import type { DiscTitleRule } from "../discTitleAnalysis.js"

/**
 * The raw `.m2ts` sitting behind a chaptered playlist.
 *
 * When a cluster (same segment map, so the same video) holds both a title
 * WITH chapter marks and one without, the chapterless one is the raw
 * stream MakeMKV also surfaces. Ripping it costs a second full-size copy
 * and loses the chapter marks.
 *
 *   TROY - DIRECTOR'S CUT   00001.mpls 12ch  vs  00005.m2ts  —  3:16:03, 90.9 GB
 *   TROY - THEATRICAL CUT   00001.mpls 12ch  vs  00005.m2ts  —  2:42:48, 89.5 GB
 *   THE PEOPLE VS LARRY FLYNT 00003.mpls 12ch vs 00000.m2ts  —  2:09:26, 92.1 GB
 *   SOYLENT GREEN           00012/4/1.mpls 12ch vs 00425.m2ts — 1:36:48, 65.5 GB
 *
 * ⚠️ Soylent Green is exactly why this discard is a proposal that
 * `isTrackSuperset` can outrank: there, the chapterless twin carries MORE
 * audio than any single playlist, which makes it the cheap one-pass source
 * rather than a duplicate. The disposition resolver ranks `inspect` above
 * `discard` so that case surfaces instead of being silently dropped.
 *
 * Never fires on a truncated cluster — "same segment map" is not a fact
 * when makemkvcon elided the tail of both maps.
 */
export const isChapterlessTwin: DiscTitleRule = {
  description:
    "A chapterless title sharing its video with a chaptered sibling — the raw stream behind a playlist.",
  evaluate: ({ clusters, graph }) =>
    clusters
      .filter(
        (cluster) =>
          !cluster.isSegmentMapTruncated &&
          cluster.titleIndices.length > 1,
      )
      .flatMap((cluster) => {
        const titlesInCluster = cluster.titleIndices
          .map((titleIndex) =>
            graph.titles.find(
              (title) => title.titleIndex === titleIndex,
            ),
          )
          .filter((title) => title !== undefined)

        const chapteredSibling = titlesInCluster.find(
          (title) =>
            title.chapterCount !== null &&
            title.chapterCount > 1,
        )

        return chapteredSibling === undefined
          ? []
          : titlesInCluster
              .filter(
                (title) =>
                  title.chapterCount === null ||
                  title.chapterCount <= 1,
              )
              .map((title) => ({
                confidence: "high" as const,
                disposition: "discard" as const,
                reason: `${title.sourceFileName}: same video as ${chapteredSibling.sourceFileName} (segment map ${cluster.segmentMapText}) but with no chapter marks — the raw stream behind the playlist.`,
                ruleName: isChapterlessTwin.name,
                titleIndices: [title.titleIndex],
              }))
      }),
  name: "isChapterlessTwin",
  validatedAgainst: [
    "[BACKUP] TROY - DIRECTOR'S CUT (UHD) - 4K",
    "[BACKUP] TROY - THEATRICAL CUT - 4K",
    "[BACKUP] THE PEOPLE VS LARRY FLYNT - 4K",
    "[BACKUP] SOYLENT GREEN - UHD - 4K",
  ],
}
