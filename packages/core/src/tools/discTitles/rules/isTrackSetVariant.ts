import {
  type DiscTitleRule,
  getIsPlaylistTitle,
  getTrackSignature,
} from "../discTitleAnalysis.js"

/**
 * Several playlists over ONE video, differing only in their track sets.
 *
 * This is the case the whole feature exists for. Soylent Green's UHD looks
 * like three 65.5 GB "editions" and is not:
 *
 *   00012.mpls  12ch  1:36:48  65.5 GB   DD 2.0 x2          2 subtitle tracks
 *   00004.mpls  12ch  1:36:48  65.5 GB   DD 2.0 x1          0 subtitle tracks
 *   00001.mpls  12ch  1:36:48  65.5 GB   LPCM 1.0           2 subtitle tracks
 *
 * All three map to segment `425` — one video file. Ripping all three costs
 * ~197 GB to obtain ~65 GB of video plus four audio tracks. The correct
 * output is not a CHOICE between them, it is a MERGE instruction: rip the
 * video once and graft the remaining audio.
 *
 * Only playlists are considered. A raw `.m2ts` in the same cluster is the
 * chapterless twin (or, when it carries every track, the superset) and has
 * its own rules.
 *
 * Never fires on a truncated cluster: two long playlists whose maps were
 * elided are not known to share a video.
 */
export const isTrackSetVariant: DiscTitleRule = {
  description:
    "Multiple playlists over one video with different audio/subtitle sets — merge them, don't choose between them.",
  evaluate: ({ clusters, graph }) =>
    clusters
      .filter((cluster) => !cluster.isSegmentMapTruncated)
      .flatMap((cluster) => {
        const playlistTitles = cluster.titleIndices
          .map((titleIndex) =>
            graph.titles.find(
              (title) => title.titleIndex === titleIndex,
            ),
          )
          .filter((title) => title !== undefined)
          .filter(getIsPlaylistTitle)

        const distinctSignatures = new Set(
          playlistTitles.map(getTrackSignature),
        )

        return playlistTitles.length > 1 &&
          distinctSignatures.size > 1
          ? [
              {
                confidence: "high" as const,
                disposition: "merge" as const,
                reason: `${playlistTitles.length} playlists (${playlistTitles
                  .map((title) => title.sourceFileName)
                  .join(
                    ", ",
                  )}) share segment map ${cluster.segmentMapText} — one video, ${
                  distinctSignatures.size
                } different track sets. Rip the video once and graft the other audio rather than ripping ${
                  playlistTitles.length
                } full copies.`,
                ruleName: isTrackSetVariant.name,
                titleIndices: playlistTitles.map(
                  (title) => title.titleIndex,
                ),
              },
            ]
          : []
      }),
  name: "isTrackSetVariant",
  validatedAgainst: ["[BACKUP] SOYLENT GREEN - UHD - 4K"],
}
