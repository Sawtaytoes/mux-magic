export const SUBTITLE_TYPE_OPTIONS = [
  {
    value: "ass",
    codec: "S_TEXT/ASS",
    description: "ASS/SSA — styled text",
  },
  {
    value: "srt",
    codec: "S_TEXT/UTF8",
    description: "SubRip — plain text",
  },
  {
    value: "sup",
    codec: "S_HDMV/PGS",
    description: "PGS — bitmap",
  },
  {
    value: "sup",
    codec: "S_HDMV/TEXTST",
    description: "TextST — bitmap+text",
  },
  {
    value: "sub",
    codec: "S_VOBSUB",
    description: "VobSub — DVD bitmap",
  },
] as const

export type SubtitleTypeOption =
  (typeof SUBTITLE_TYPE_OPTIONS)[number]
