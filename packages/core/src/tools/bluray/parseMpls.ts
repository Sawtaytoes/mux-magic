/**
 * A minimal `BDMV/PLAYLIST/*.mpls` reader.
 *
 * Built because `makemkvcon info` turned out NOT to be enough. Its `TINFO`
 * segment-map field is capped around 370 characters and ends in `...`, so
 * a playlist with many segments reports a PREFIX of its map — Soylent
 * Green's `00010.mpls` claims 236 segments and lists ~120. Clustering long
 * playlists on that is guesswork; reading the playlist itself is not.
 *
 * Three things are extracted, and nothing else:
 *
 *  - **the full clip list** (`00004.m2ts`, …), which defeats the truncation
 *  - **chapter marks**, needed to graft chapters onto a raw-stream rip
 *  - **audio/subtitle PIDs**, needed to graft a specific audio track by PID
 *
 * The format is big-endian throughout, and every timestamp is in 45 kHz
 * ticks. Layout per the widely-mirrored MPLS notes and checked against the
 * committed byte fixtures — where the two disagree, the fixtures win.
 */

const mplsTicksPerSecond = 45000
const playlistEndMarkerToleranceSeconds = 2

export type MplsStream = {
  /** 0x01 MPEG-1 video … 0x90 PCM, 0x80 LPCM, 0x90 PGS. Raw coding type. */
  codingType: number
  languageCode: string
  /** The PID to select this track by when grafting. */
  packetId: number
  streamKind:
    | "primaryVideo"
    | "primaryAudio"
    | "primarySubtitle"
    | "interactive"
}

export type MplsPlayItem = {
  /** `00004` — join with `.m2ts` for the stream file. */
  clipFileName: string
  durationSeconds: number
  inTimeTicks: number
  outTimeTicks: number
  streams: MplsStream[]
}

export type MplsChapterMark = {
  playItemIndex: number
  timestampSeconds: number
  timestampTicks: number
}

export type MplsPlaylist = {
  chapterMarks: MplsChapterMark[]
  playItems: MplsPlayItem[]
  version: string
}

const readUnsignedInteger = ({
  byteLength,
  bytes,
  offset,
}: {
  byteLength: number
  bytes: Buffer
  offset: number
}) =>
  Array.from({ length: byteLength }).reduce<number>(
    (total, _unused, byteIndex) =>
      total * 256 + bytes[offset + byteIndex],
    0,
  )

const readAsciiText = ({
  byteLength,
  bytes,
  offset,
}: {
  byteLength: number
  bytes: Buffer
  offset: number
}) =>
  bytes
    .subarray(offset, offset + byteLength)
    .toString("latin1")
    .replace(/\0+$/, "")

/**
 * Walk the STN table's stream entries.
 *
 * Each entry is a length-prefixed stream-entry block followed by a
 * length-prefixed attributes block, so the only way through is
 * sequentially — hence the offset-threading reduce rather than a map.
 *
 * The language code sits at a different offset per coding type: audio
 * carries a format/rate byte first, subtitles do not. Video entries carry
 * no language at all.
 */
const readStreamEntries = ({
  bytes,
  offset,
  streamCounts,
}: {
  bytes: Buffer
  offset: number
  streamCounts: {
    count: number
    streamKind: MplsStream["streamKind"]
  }[]
}) =>
  streamCounts
    .flatMap(({ count, streamKind }) =>
      Array.from({ length: count }, () => streamKind),
    )
    .reduce<{ nextOffset: number; streams: MplsStream[] }>(
      (accumulated, streamKind) => {
        const entryLength = bytes[accumulated.nextOffset]
        const entryStart = accumulated.nextOffset + 1
        const entryType = bytes[entryStart]

        // type 1 = the PID lives in this playlist's own clip; types 2/4
        // reference a sub-path, where the PID sits two bytes later.
        const packetIdOffset =
          entryType === 1 ? entryStart + 1 : entryStart + 3

        const attributesStart = entryStart + entryLength
        const attributesLength = bytes[attributesStart]
        const codingType = bytes[attributesStart + 1]

        return {
          nextOffset:
            attributesStart + 1 + attributesLength,
          streams: accumulated.streams.concat({
            codingType,
            languageCode:
              streamKind === "primaryVideo"
                ? ""
                : readAsciiText({
                    byteLength: 3,
                    bytes,
                    // Audio prefixes a format/sample-rate byte that
                    // subtitle and text entries do not carry.
                    offset:
                      streamKind === "primaryAudio"
                        ? attributesStart + 3
                        : attributesStart + 2,
                  }),
            packetId: readUnsignedInteger({
              byteLength: 2,
              bytes,
              offset: packetIdOffset,
            }),
            streamKind,
          }),
        }
      },
      { nextOffset: offset, streams: [] },
    )

const readPlayItem = ({
  bytes,
  offset,
}: {
  bytes: Buffer
  offset: number
}) => {
  const itemLength = readUnsignedInteger({
    byteLength: 2,
    bytes,
    offset,
  })
  const clipFileName = readAsciiText({
    byteLength: 5,
    bytes,
    offset: offset + 2,
  })
  const isMultiAngle =
    (bytes[offset + 12] & 0b0001_0000) !== 0
  const inTimeTicks = readUnsignedInteger({
    byteLength: 4,
    bytes,
    offset: offset + 14,
  })
  const outTimeTicks = readUnsignedInteger({
    byteLength: 4,
    bytes,
    offset: offset + 18,
  })

  // UO mask (8) + flags (1) + still mode (1) + still time (2) = 12 bytes
  // after OUT_time, then the optional multi-angle block.
  const afterStillOffset = offset + 22 + 12
  const angleCount = isMultiAngle
    ? bytes[afterStillOffset]
    : 1
  const stnTableOffset = isMultiAngle
    ? afterStillOffset + 2 + (angleCount - 1) * 10
    : afterStillOffset

  return {
    // itemLength counts everything after its own 2-byte field.
    nextOffset: offset + 2 + itemLength,
    playItem: {
      clipFileName,
      durationSeconds:
        (outTimeTicks - inTimeTicks) / mplsTicksPerSecond,
      inTimeTicks,
      outTimeTicks,
      streams: readStreamEntries({
        bytes,
        // STN table header is 16 bytes: length (2) + reserved (2) + SEVEN
        // count bytes (video, audio, PG, IG, secondary audio, secondary
        // video, PiP PG) + five reserved. Counting eight here shifted every
        // stream entry by one byte, which read the language bytes as the
        // PID — subtitle tracks came back with "PID 0x656e", i.e. "en".
        offset: stnTableOffset + 16,
        streamCounts: [
          {
            count: bytes[stnTableOffset + 4],
            streamKind: "primaryVideo" as const,
          },
          {
            count: bytes[stnTableOffset + 5],
            streamKind: "primaryAudio" as const,
          },
          {
            count: bytes[stnTableOffset + 6],
            streamKind: "primarySubtitle" as const,
          },
          {
            count: bytes[stnTableOffset + 7],
            streamKind: "interactive" as const,
          },
        ],
      }).streams,
    },
  }
}

export const parseMpls = (bytes: Buffer): MplsPlaylist => {
  const magic = readAsciiText({
    byteLength: 4,
    bytes,
    offset: 0,
  })

  if (magic !== "MPLS") {
    throw new Error(
      `Not an MPLS playlist: magic was ${JSON.stringify(magic)}`,
    )
  }

  const playlistStart = readUnsignedInteger({
    byteLength: 4,
    bytes,
    offset: 8,
  })
  const playlistMarkStart = readUnsignedInteger({
    byteLength: 4,
    bytes,
    offset: 12,
  })
  const playItemCount = readUnsignedInteger({
    byteLength: 2,
    bytes,
    offset: playlistStart + 6,
  })

  return {
    chapterMarks: Array.from(
      {
        length: readUnsignedInteger({
          byteLength: 2,
          bytes,
          offset: playlistMarkStart + 4,
        }),
      },
      (_unused, markIndex) =>
        ((markOffset) => ({
          playItemIndex: readUnsignedInteger({
            byteLength: 2,
            bytes,
            offset: markOffset + 2,
          }),
          timestampSeconds:
            readUnsignedInteger({
              byteLength: 4,
              bytes,
              offset: markOffset + 4,
            }) / mplsTicksPerSecond,
          timestampTicks: readUnsignedInteger({
            byteLength: 4,
            bytes,
            offset: markOffset + 4,
          }),
        }))(playlistMarkStart + 6 + markIndex * 14),
    ).filter(
      // mark_type 0x01 is an entry mark (a real chapter); 0x02 is a link
      // point, which is navigation, not a chapter.
      (_unused, markIndex) =>
        bytes[
          playlistMarkStart + 6 + markIndex * 14 + 1
        ] === 1,
    ),
    playItems: Array.from({
      length: playItemCount,
    }).reduce<{
      items: MplsPlayItem[]
      offset: number
    }>(
      (accumulated) =>
        ((read) => ({
          items: accumulated.items.concat(read.playItem),
          offset: read.nextOffset,
        }))(
          readPlayItem({
            bytes,
            offset: accumulated.offset,
          }),
        ),
      { items: [], offset: playlistStart + 10 },
    ).items,
    version: readAsciiText({
      byteLength: 4,
      bytes,
      offset: 4,
    }),
  }
}

/**
 * The full clip list, in play order — the thing `TINFO`'s segment map
 * cannot be trusted to give for a long playlist.
 *
 * ⚠️ This can be LONGER than makemkvcon's segment map even when that map
 * is not truncated. Both The Outfit's `00011.mpls` and Soylent Green's
 * `00012.mpls` end with a ~1-second bumper clip (`00016`, `00426`) that
 * makemkvcon leaves out of its map and out of its segment count. Neither
 * is wrong; they are answering different questions. Compare on the
 * playlist's own terms, not against `segmentMapText`.
 */
export const getMplsSegmentFileNames = (
  playlist: MplsPlaylist,
) =>
  playlist.playItems.map(
    (playItem) => `${playItem.clipFileName}.m2ts`,
  )

export const getMplsTotalDurationSeconds = (
  playlist: MplsPlaylist,
) =>
  playlist.playItems.reduce(
    (total, playItem) => total + playItem.durationSeconds,
    0,
  )

/**
 * Chapter marks as seconds from the start of the playlist.
 *
 * Raw mark timestamps are in each CLIP's timebase, so they restart at
 * every play item — the marks on item 1 read as *earlier* than the marks
 * on item 0 and are not monotonic. Grafting those onto a rip would put
 * every chapter after the first segment in the wrong place. Converting to
 * playlist-relative time (elapsed items, plus the offset into the current
 * item) is what makes them usable.
 *
 * The final mark usually lands exactly on the playlist's end — an end
 * marker, not a chapter — which is why MakeMKV reports one fewer chapter
 * than there are marks. `isPlaylistEndMarker` flags it rather than
 * dropping it, since that relationship is a convention, not a guarantee.
 */
export const getMplsChapterTimesFromPlaylistStart = (
  playlist: MplsPlaylist,
) =>
  ((totalDurationSeconds: number) =>
    playlist.chapterMarks.map((mark) =>
      ((secondsFromStart: number) => ({
        // Tolerance rather than an exact match: on both fixtures the end
        // marker sits at the START of a trailing ~1.001-second bumper
        // clip, so it lands just over a second short of the total.
        isPlaylistEndMarker:
          totalDurationSeconds - secondsFromStart <
          playlistEndMarkerToleranceSeconds,
        secondsFromStart,
      }))(
        playlist.playItems
          .slice(0, mark.playItemIndex)
          .reduce(
            (total, playItem) =>
              total + playItem.durationSeconds,
            0,
          ) +
          (mark.timestampTicks -
            (playlist.playItems[mark.playItemIndex]
              ?.inTimeTicks ?? 0)) /
            mplsTicksPerSecond,
      ),
    ))(getMplsTotalDurationSeconds(playlist))
