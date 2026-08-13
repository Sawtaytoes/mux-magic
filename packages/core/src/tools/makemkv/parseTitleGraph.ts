import {
  apItemAttributeId,
  getStreamKindFromTypeCode,
  type StreamKind,
} from "./apItemAttributeIds.js"
import {
  type DiscAttributeEvent,
  getIsKeyFailureEvent,
  type MakemkvEvent,
  type MessageEvent,
  makemkvMessageCode,
  type StreamAttributeEvent,
  type TitleAttributeEvent,
} from "./makemkvEvents.js"
import { parseMakemkvLine } from "./parseLine.js"

export type DiscTitleStream = {
  bitrateText: string
  channelCount: number | null
  channelLayoutName: string
  codecId: string
  codecLong: string
  codecShort: string
  kind: StreamKind
  languageCode: string
  languageName: string
  mkvFlags: string
  name: string
  sampleRate: number | null
  streamIndex: number
  videoFrameRate: string
  videoSize: string
}

export type DiscTitle = {
  chapterCount: number | null
  durationSeconds: number | null
  durationText: string
  /**
   * True when makemkvcon elided the tail of the segment map. Real output
   * caps the field at roughly 370 characters and ends it with `...`, so a
   * long playlist's map is a PREFIX, never the whole list. Any rule that
   * compares maps for identity must refuse to conclude "identical" when
   * this is set — the difference could be entirely in the elided tail.
   */
  isSegmentMapTruncated: boolean
  name: string
  outputFileName: string
  segmentCount: number | null
  segmentMap: number[]
  segmentMapText: string
  sizeBytes: number | null
  sizeText: string
  /** `00850.mpls` or `00425.m2ts` — the mpls/stream distinction. */
  sourceFileName: string
  streams: DiscTitleStream[]
  titleIndex: number
}

/**
 * A title makemkvcon mentioned but did not include in the graph.
 *
 * Worth surfacing rather than dropping: `TITLE_IS_DUPLICATE` is MakeMKV
 * pre-collapsing playlists it considers equal, which is a signal in its
 * own right, and `TITLE_TOO_SHORT` explains a missing extra.
 */
export type SkippedTitle = {
  reason: "duplicate" | "tooShort"
  sourceFileName: string
  /** For duplicates, the title MakeMKV kept instead. */
  supersededBySourceFileName: string
}

export type DiscTitleGraph = {
  discName: string
  discTypeText: string
  keyFailureMessages: MessageEvent[]
  malformedLineCount: number
  reportedTitleCount: number | null
  skippedTitles: SkippedTitle[]
  titles: DiscTitle[]
}

const parseDurationSeconds = (durationText: string) =>
  /^\d+:\d{2}:\d{2}$/.test(durationText)
    ? durationText
        .split(":")
        .reduce(
          (total, part) =>
            total * 60 + Number.parseInt(part, 10),
          0,
        )
    : null

const parseIntegerOrNull = (value: string) =>
  Number.isFinite(Number.parseInt(value, 10))
    ? Number.parseInt(value, 10)
    : null

const parseSegmentMap = (segmentMapText: string) =>
  segmentMapText
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((segment) => Number.isFinite(segment))

type AttributeMap = Map<number, string>

const readAttribute = ({
  attributeId,
  attributes,
}: {
  attributeId: number
  attributes: AttributeMap
}) => attributes.get(attributeId) ?? ""

const buildStream = ({
  attributes,
  streamIndex,
  typeCode,
}: {
  attributes: AttributeMap
  streamIndex: number
  typeCode: number
}): DiscTitleStream => ({
  bitrateText: readAttribute({
    attributeId: apItemAttributeId.BITRATE,
    attributes,
  }),
  channelCount: parseIntegerOrNull(
    readAttribute({
      attributeId: apItemAttributeId.AUDIO_CHANNELS_COUNT,
      attributes,
    }),
  ),
  channelLayoutName: readAttribute({
    attributeId:
      apItemAttributeId.AUDIO_CHANNEL_LAYOUT_NAME,
    attributes,
  }),
  codecId: readAttribute({
    attributeId: apItemAttributeId.CODEC_ID,
    attributes,
  }),
  codecLong: readAttribute({
    attributeId: apItemAttributeId.CODEC_LONG,
    attributes,
  }),
  codecShort: readAttribute({
    attributeId: apItemAttributeId.CODEC_SHORT,
    attributes,
  }),
  kind: getStreamKindFromTypeCode(typeCode),
  // A stream's real track language is LANG_CODE (3). METADATA_LANGUAGE_CODE
  // (28) is the disc's metadata language and is "eng" on every stream of an
  // English disc, including the video — using it would label every
  // commentary track English and hide the very thing we are looking for.
  languageCode: readAttribute({
    attributeId: apItemAttributeId.LANG_CODE,
    attributes,
  }),
  languageName: readAttribute({
    attributeId: apItemAttributeId.LANG_NAME,
    attributes,
  }),
  mkvFlags: readAttribute({
    attributeId: apItemAttributeId.MKV_FLAGS,
    attributes,
  }),
  name: readAttribute({
    attributeId: apItemAttributeId.NAME,
    attributes,
  }),
  sampleRate: parseIntegerOrNull(
    readAttribute({
      attributeId: apItemAttributeId.AUDIO_SAMPLE_RATE,
      attributes,
    }),
  ),
  streamIndex,
  videoFrameRate: readAttribute({
    attributeId: apItemAttributeId.VIDEO_FRAME_RATE,
    attributes,
  }),
  videoSize: readAttribute({
    attributeId: apItemAttributeId.VIDEO_SIZE,
    attributes,
  }),
})

const buildTitle = ({
  attributes,
  streams,
  titleIndex,
}: {
  attributes: AttributeMap
  streams: DiscTitleStream[]
  titleIndex: number
}): DiscTitle =>
  ((segmentMapText: string) => ({
    chapterCount: parseIntegerOrNull(
      readAttribute({
        attributeId: apItemAttributeId.CHAPTER_COUNT,
        attributes,
      }),
    ),
    durationSeconds: parseDurationSeconds(
      readAttribute({
        attributeId: apItemAttributeId.DURATION,
        attributes,
      }),
    ),
    durationText: readAttribute({
      attributeId: apItemAttributeId.DURATION,
      attributes,
    }),
    isSegmentMapTruncated: segmentMapText.endsWith("..."),
    name: readAttribute({
      attributeId: apItemAttributeId.NAME,
      attributes,
    }),
    outputFileName: readAttribute({
      attributeId: apItemAttributeId.OUTPUT_FILE_NAME,
      attributes,
    }),
    segmentCount: parseIntegerOrNull(
      readAttribute({
        attributeId: apItemAttributeId.SEGMENTS_COUNT,
        attributes,
      }),
    ),
    segmentMap: parseSegmentMap(segmentMapText),
    segmentMapText,
    sizeBytes: parseIntegerOrNull(
      readAttribute({
        attributeId: apItemAttributeId.DISK_SIZE_BYTES,
        attributes,
      }),
    ),
    sizeText: readAttribute({
      attributeId: apItemAttributeId.DISK_SIZE,
      attributes,
    }),
    sourceFileName: readAttribute({
      attributeId: apItemAttributeId.SOURCE_FILE_NAME,
      attributes,
    }),
    streams,
    titleIndex,
  }))(
    readAttribute({
      attributeId: apItemAttributeId.SEGMENTS_MAP,
      attributes,
    }),
  )

const getSkippedTitleFromMessage = (
  event: MessageEvent,
): SkippedTitle | null =>
  event.code === makemkvMessageCode.TITLE_TOO_SHORT
    ? {
        reason: "tooShort",
        sourceFileName: event.params[0] ?? "",
        supersededBySourceFileName: "",
      }
    : event.code === makemkvMessageCode.TITLE_IS_DUPLICATE
      ? {
          reason: "duplicate",
          sourceFileName: event.params[0] ?? "",
          supersededBySourceFileName: event.params[1] ?? "",
        }
      : null

const getIsDiscAttributeEvent = (
  event: MakemkvEvent,
): event is DiscAttributeEvent => event.type === "CINFO"

const getIsTitleAttributeEvent = (
  event: MakemkvEvent,
): event is TitleAttributeEvent => event.type === "TINFO"

const getIsStreamAttributeEvent = (
  event: MakemkvEvent,
): event is StreamAttributeEvent => event.type === "SINFO"

const getIsMessageEvent = (
  event: MakemkvEvent,
): event is MessageEvent => event.type === "MSG"

/**
 * Later attributes win.
 *
 * `new Map(entries)` keeps the last entry for a repeated key, which
 * matches how makemkvcon re-emits an attribute it has refined.
 */
const toAttributeMap = (
  attributeEvents: {
    attributeId: number
    value: string
  }[],
): AttributeMap =>
  new Map(
    attributeEvents.map((event) => [
      event.attributeId,
      event.value,
    ]),
  )

const buildStreamsForTitle = (
  streamEvents: StreamAttributeEvent[],
) =>
  Array.from(
    Map.groupBy(
      streamEvents,
      (event) => event.streamIndex,
    ).entries(),
  )
    .sort(
      ([leftIndex], [rightIndex]) => leftIndex - rightIndex,
    )
    .map(([streamIndex, eventsForStream]) =>
      buildStream({
        attributes: toAttributeMap(eventsForStream),
        streamIndex,
        // The stream-type value is localised and useless for branching;
        // the `code` alongside it is the stable signal.
        typeCode:
          eventsForStream.find(
            (event) =>
              event.attributeId === apItemAttributeId.TYPE,
          )?.code ?? 0,
      }),
    )

/**
 * Fold a stream of parsed robot-mode events into a disc title graph.
 *
 * Attribute lines arrive interleaved and out of order, so each level is
 * grouped by its index and materialised in one pass.
 */
export const buildTitleGraphFromEvents = (
  events: MakemkvEvent[],
): DiscTitleGraph =>
  ((
    discAttributes: AttributeMap,
    messageEvents: MessageEvent[],
    streamEventsByTitleIndex: Map<
      number,
      StreamAttributeEvent[]
    >,
  ) => ({
    discName:
      discAttributes.get(apItemAttributeId.NAME) ?? "",
    discTypeText:
      discAttributes.get(apItemAttributeId.TYPE) ?? "",
    keyFailureMessages: messageEvents.filter(
      getIsKeyFailureEvent,
    ),
    malformedLineCount: events.filter(
      (event) => event.type === "MALFORMED",
    ).length,
    reportedTitleCount:
      events.findLast((event) => event.type === "TCOUNT")
        ?.count ?? null,
    skippedTitles: messageEvents
      .map(getSkippedTitleFromMessage)
      .filter((skipped) => skipped !== null),
    titles: Array.from(
      Map.groupBy(
        events.filter(getIsTitleAttributeEvent),
        (event) => event.titleIndex,
      ).entries(),
    )
      .sort(
        ([leftIndex], [rightIndex]) =>
          leftIndex - rightIndex,
      )
      .map(([titleIndex, eventsForTitle]) =>
        buildTitle({
          attributes: toAttributeMap(eventsForTitle),
          streams: buildStreamsForTitle(
            streamEventsByTitleIndex.get(titleIndex) ?? [],
          ),
          titleIndex,
        }),
      ),
  }))(
    toAttributeMap(events.filter(getIsDiscAttributeEvent)),
    events.filter(getIsMessageEvent),
    Map.groupBy(
      events.filter(getIsStreamAttributeEvent),
      (event) => event.titleIndex,
    ),
  )

export const parseTitleGraph = (robotOutput: string) =>
  buildTitleGraphFromEvents(
    robotOutput
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map(parseMakemkvLine),
  )
