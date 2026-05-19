// Single source of truth for subtitle codec ↔ extension mapping. Both
// the schema's `subtitleTypes` enum and the app-command's per-track
// filter resolve through this map so a future codec addition only edits
// one place.
//
// `sup` is intentionally ambiguous on the input side: both `S_HDMV/PGS`
// (bitmap) and `S_HDMV/TEXTST` (bitmap + text) produce a `.sup` file.
// The include/exclude filter treats both as `sup`, matching what a user
// filtering by output file format would expect.

export const subtitleExtensionByCodec = {
  "S_TEXT/ASS": "ass",
  "S_TEXT/UTF8": "srt",
  "S_HDMV/PGS": "sup",
  "S_HDMV/TEXTST": "sup",
  S_VOBSUB: "sub",
} as const satisfies Record<string, string>

export type SubtitleCodecId =
  keyof typeof subtitleExtensionByCodec

export type SubtitleTypeExtension =
  (typeof subtitleExtensionByCodec)[SubtitleCodecId]

export const subtitleTypeExtensions = [
  "ass",
  "srt",
  "sup",
  "sub",
] as const satisfies ReadonlyArray<SubtitleTypeExtension>

export const isKnownSubtitleCodecId = (
  codecId: string,
): codecId is SubtitleCodecId =>
  Object.hasOwn(subtitleExtensionByCodec, codecId)

export const getSubtitleExtensionForCodec = (
  codecId: string,
): SubtitleTypeExtension | undefined =>
  isKnownSubtitleCodecId(codecId)
    ? subtitleExtensionByCodec[codecId]
    : undefined
