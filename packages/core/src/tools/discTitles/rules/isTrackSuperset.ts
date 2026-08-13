import {
  type DiscTitleRule,
  getTrackSignature,
} from "../discTitleAnalysis.js"

/**
 * The one title in a cluster that carries every track its siblings expose.
 *
 * Soylent Green's raw `00425.m2ts` holds LPCM 1.0 **and** all three DD 2.0
 * tracks, where each playlist exposes only a subset:
 *
 *   00001.mpls  LPCM 1.0                    (the mono original)
 *   00004.mpls  DD 2.0 x1
 *   00012.mpls  DD 2.0 x2
 *   00425.m2ts  LPCM 1.0 + DD 2.0 x3   ← every track, one file
 *
 * That makes it the cheap single-pass source: rip it once instead of
 * ripping three 65.5 GB playlists and merging.
 *
 * ⚠️ Surfaced as `inspect`, never taken silently, for two reasons. It
 * INVERTS the "no chapters = junk" rule — the superset here is the very
 * title `isChapterlessTwin` proposes discarding — so taking it
 * automatically would mean a rule quietly overriding another rule's
 * discard. And the chapters still have to come from somewhere (parsed out
 * of the `.mpls` and grafted on), which is a different execution path with
 * its own failure mode.
 *
 * Note also the ambiguity this exposes rather than hides: the release
 * lists two commentaries, but the disc carries three DD 2.0 tracks. Which
 * is which is the probe step's job, not this rule's.
 */
export const isTrackSuperset: DiscTitleRule = {
  description:
    "A title carrying every audio/subtitle track its cluster siblings expose — a candidate one-pass rip source.",
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

        const trackSetsByTitleIndex = new Map(
          titlesInCluster.map((title) => [
            title.titleIndex,
            new Set(getTrackSignature(title).split("|")),
          ]),
        )

        return titlesInCluster
          .filter((candidate) => {
            const candidateTracks =
              trackSetsByTitleIndex.get(
                candidate.titleIndex,
              )

            return (
              candidateTracks !== undefined &&
              candidateTracks.size > 0 &&
              titlesInCluster.some(
                (sibling) =>
                  sibling.titleIndex !==
                    candidate.titleIndex &&
                  (trackSetsByTitleIndex.get(
                    sibling.titleIndex,
                  )?.size ?? 0) < candidateTracks.size,
              ) &&
              titlesInCluster.every((sibling) =>
                Array.from(
                  trackSetsByTitleIndex.get(
                    sibling.titleIndex,
                  ) ?? [],
                ).every((track) =>
                  candidateTracks.has(track),
                ),
              )
            )
          })
          .map((candidate) => ({
            confidence: "medium" as const,
            disposition: "inspect" as const,
            reason: `${candidate.sourceFileName} carries every audio/subtitle track its siblings expose (segment map ${cluster.segmentMapText}) — ripping it once is cheaper than ripping each playlist, but the chapter marks would have to be grafted from the .mpls.`,
            ruleName: isTrackSuperset.name,
            titleIndices: [candidate.titleIndex],
          }))
      }),
  name: "isTrackSuperset",
  validatedAgainst: ["[BACKUP] SOYLENT GREEN - UHD - 4K"],
}
