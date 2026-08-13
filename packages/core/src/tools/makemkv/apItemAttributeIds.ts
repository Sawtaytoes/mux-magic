/**
 * MakeMKV's `AP_ItemAttributeId` enum, from `apdefs.h` in the
 * `makemkv-oss` tarball — the canonical source. The numeric IDs are
 * stable across versions; the human-readable strings behind them are not
 * (they are localised), which is why every rule downstream keys on the ID
 * and, where it can, on the machine-readable value rather than the
 * rendered `TREE_INFO` text.
 *
 * rip-deck models no attribute IDs at all (its one constant is
 * `CINFO_DISC_NAME = 2`), so this is new work rather than a port.
 *
 * Every ID below was cross-checked against the captured fixtures in
 * `__fixtures__/` before being trusted — notably that a title's language
 * arrives on `METADATA_LANGUAGE_CODE` (28) while a *stream's* real track
 * language arrives on `LANG_CODE` (3). Confusing the two silently labels
 * every commentary track "English" on an English disc and hides the
 * problem entirely.
 */
export const apItemAttributeId = {
  UNKNOWN: 0,
  TYPE: 1,
  NAME: 2,
  LANG_CODE: 3,
  LANG_NAME: 4,
  CODEC_ID: 5,
  CODEC_SHORT: 6,
  CODEC_LONG: 7,
  CHAPTER_COUNT: 8,
  DURATION: 9,
  DISK_SIZE: 10,
  DISK_SIZE_BYTES: 11,
  STREAM_TYPE_EXTENSION: 12,
  BITRATE: 13,
  AUDIO_CHANNELS_COUNT: 14,
  ANGLE_INFO: 15,
  SOURCE_FILE_NAME: 16,
  AUDIO_SAMPLE_RATE: 17,
  AUDIO_SAMPLE_SIZE: 18,
  VIDEO_SIZE: 19,
  VIDEO_ASPECT_RATIO: 20,
  VIDEO_FRAME_RATE: 21,
  STREAM_FLAGS: 22,
  DATE_TIME: 23,
  ORIGINAL_TITLE_ID: 24,
  SEGMENTS_COUNT: 25,
  SEGMENTS_MAP: 26,
  OUTPUT_FILE_NAME: 27,
  METADATA_LANGUAGE_CODE: 28,
  METADATA_LANGUAGE_NAME: 29,
  TREE_INFO: 30,
  PANEL_TITLE: 31,
  VOLUME_NAME: 32,
  ORDER_WEIGHT: 33,
  OUTPUT_FORMAT: 34,
  OUTPUT_FORMAT_DESCRIPTION: 35,
  SEAMLESS_INFO: 36,
  PANEL_TEXT: 37,
  MKV_FLAGS: 38,
  MKV_FLAGS_TEXT: 39,
  AUDIO_CHANNEL_LAYOUT_NAME: 40,
  OUTPUT_CODEC_SHORT: 41,
  OUTPUT_CONVERSION_TYPE: 42,
  OUTPUT_AUDIO_SAMPLE_RATE: 43,
  OUTPUT_AUDIO_SAMPLE_SIZE: 44,
  OUTPUT_AUDIO_CHANNELS_COUNT: 45,
  OUTPUT_AUDIO_CHANNEL_LAYOUT_NAME: 46,
  OUTPUT_AUDIO_CHANNEL_LAYOUT: 47,
  OUTPUT_AUDIO_MIX_DESCRIPTION: 48,
  COMMENT: 49,
  OFFSET_SEQUENCE_ID: 50,
} as const

/**
 * `SINFO:<title>,<stream>,1,<code>,"Video"` — the localised *value* is
 * useless for branching, but the `code` beside it is not. These three
 * are the stream-type codes seen in every captured fixture.
 */
export const apStreamTypeCode = {
  VIDEO: 6201,
  AUDIO: 6202,
  SUBTITLES: 6203,
} as const

export type StreamKind =
  | "video"
  | "audio"
  | "subtitles"
  | "other"

export const getStreamKindFromTypeCode = (
  typeCode: number,
): StreamKind =>
  typeCode === apStreamTypeCode.VIDEO
    ? "video"
    : typeCode === apStreamTypeCode.AUDIO
      ? "audio"
      : typeCode === apStreamTypeCode.SUBTITLES
        ? "subtitles"
        : "other"
