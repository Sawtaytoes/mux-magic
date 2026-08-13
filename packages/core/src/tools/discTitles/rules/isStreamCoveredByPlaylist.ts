import {
  type DiscTitleRule,
  getIsPlaylistTitle,
  getIsStreamTitle,
} from "../discTitleAnalysis.js"

/**
 * A raw `.m2ts` whose segments a playlist already covers.
 *
 * MakeMKV surfaces both the playlists and the underlying streams. Where a
 * stream title's segments are a subset of some playlist's, ripping the
 * stream duplicates video the playlist already brings in — without the
 * playlist's chapter marks or track selection.
 *
 * Deliberately narrower than `isChapterlessTwin`: that one handles the
 * same-cluster case (identical maps). This one catches a stream that is
 * one PIECE of a longer playlist, which is a different shape and a
 * different reason string.
 *
 * ⚠️ Never fires against a truncated playlist map. A truncated map is a
 * prefix, so "the playlist covers this segment" cannot be ruled out OR in
 * from the elided tail, and a false positive here discards a real extra.
 *
 * ⚠️ Also skipped when the stream is a track superset — that case is the
 * cheap one-pass source, and `isTrackSuperset` proposes `inspect`, which
 * the resolver ranks above this `discard`.
 */
export const isStreamCoveredByPlaylist: DiscTitleRule = {
  description:
    "A raw stream title whose segments a playlist already covers — duplicate video without the chapters.",
  evaluate: ({ graph }) =>
    ((playlistTitles) =>
      graph.titles
        .filter(getIsStreamTitle)
        .filter((title) => title.segmentMap.length > 0)
        .flatMap((streamTitle) =>
          ((coveringPlaylist) =>
            coveringPlaylist === undefined
              ? []
              : [
                  {
                    confidence: "medium" as const,
                    disposition: "discard" as const,
                    reason: `${streamTitle.sourceFileName} (segments ${streamTitle.segmentMapText}) is already covered by ${coveringPlaylist.sourceFileName} (segments ${coveringPlaylist.segmentMapText}) — duplicate video without that playlist's chapter marks.`,
                    ruleName:
                      isStreamCoveredByPlaylist.name,
                    titleIndices: [streamTitle.titleIndex],
                  },
                ])(
            playlistTitles.find(
              (playlistTitle) =>
                playlistTitle.segmentMap.length >
                  streamTitle.segmentMap.length &&
                streamTitle.segmentMap.every((segment) =>
                  playlistTitle.segmentMap.includes(
                    segment,
                  ),
                ),
            ),
          ),
        ))(
      graph.titles
        .filter(getIsPlaylistTitle)
        .filter((title) => !title.isSegmentMapTruncated),
    ),
  name: "isStreamCoveredByPlaylist",
  validatedAgainst: [
    "[BACKUP] Desk Set - Blu-ray",
    "[BACKUP] THE OUTFIT - Blu-ray",
  ],
}
