import type { DiscTitleGraph } from "../makemkv/parseTitleGraph.js"
import type { TitleCluster } from "./discTitleAnalysis.js"

/**
 * Group titles that play the same video.
 *
 * Blu-ray playlists are built from `.m2ts` segment lists, so two titles
 * referencing the same segments in the same order are the same film with
 * different audio/subtitle sets — not different editions. This collapses
 * the near-duplicate explosion into a handful of real clusters, and it is
 * the single most valuable computation in the analyser.
 *
 * Validated against `[BACKUP] SOYLENT GREEN - UHD - 4K`, where
 * `00012.mpls`, `00004.mpls`, `00001.mpls` and the raw `00425.m2ts` all
 * map to segment `425` — four titles, ~197 GB of apparent rips, one
 * 65.5 GB video.
 *
 * ⚠️ Truncation. makemkvcon caps the segment-map field at roughly 370
 * characters and ends it with `...`, so a long playlist's map is a PREFIX.
 * Titles whose maps were truncated are clustered by that prefix but the
 * cluster is FLAGGED, because the difference between two long playlists
 * could be entirely in the elided tail. Downstream rules must not claim
 * identity on a flagged cluster; resolving those needs the `.mpls` parser.
 */
export const clusterTitlesBySegmentMap = ({
  graph,
}: {
  graph: DiscTitleGraph
}): TitleCluster[] =>
  Array.from(
    Map.groupBy(graph.titles, (title) =>
      // The segment count joins the key so a truncated map can't collide
      // with a genuinely shorter one that happens to share a prefix.
      [title.segmentMapText, title.segmentCount ?? ""].join(
        "#",
      ),
    ).entries(),
  )
    .map(([clusterKey, titlesInCluster]) => ({
      clusterKey,
      isSegmentMapTruncated: titlesInCluster.some(
        (title) => title.isSegmentMapTruncated,
      ),
      segmentMapText: titlesInCluster[0].segmentMapText,
      titleIndices: titlesInCluster.map(
        (title) => title.titleIndex,
      ),
    }))
    .sort((leftCluster, rightCluster) =>
      leftCluster.titleIndices[0] === undefined ||
      rightCluster.titleIndices[0] === undefined
        ? 0
        : leftCluster.titleIndices[0] -
          rightCluster.titleIndices[0],
    )

/**
 * How many segments two titles share, as a fraction of the larger map.
 *
 * Used to tell a genuinely different cut (theatrical vs extended — mostly
 * shared, differing in a handful) from an unrelated title.
 */
export const getSegmentOverlapRatio = ({
  leftSegments,
  rightSegments,
}: {
  leftSegments: number[]
  rightSegments: number[]
}) =>
  leftSegments.length === 0 || rightSegments.length === 0
    ? 0
    : leftSegments.filter((segment) =>
        rightSegments.includes(segment),
      ).length /
      Math.max(leftSegments.length, rightSegments.length)
