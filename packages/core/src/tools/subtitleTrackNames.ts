// Subtitle track names are provenance: they record which group the subs
// came from, which role the track plays, and whether the owner edited it.
// Extraction drops them (a standalone `.ass` has no container-level
// title), so they ride in the filename as base64url — a quarter of the
// real names contain `/` or `:`, which no filename can carry.

export const subtitleTrackRoles = [
  "Full Subtitles",
  "Signs & Songs",
  "Forced",
  "Commentary",
] as const

export type SubtitleTrackRole =
  (typeof subtitleTrackRoles)[number]

export const editedBySuffix = "(edited by Sawtaytoes)"

export const encodedTrackNamePrefix = "name-"

export const encodeSubtitleTrackName = (
  trackName: string,
) =>
  encodedTrackNamePrefix.concat(
    Buffer.from(trackName, "utf8").toString("base64url"),
  )

export const decodeSubtitleTrackName = (
  encodedSegment: string,
) =>
  Buffer.from(
    encodedSegment.slice(encodedTrackNamePrefix.length),
    "base64url",
  ).toString("utf8")

const encodedSegmentPattern = new RegExp(
  `^${encodedTrackNamePrefix}[A-Za-z0-9_-]+$`,
)

export const isEncodedTrackNameSegment = (
  segment: string,
) => encodedSegmentPattern.test(segment)

export const findEncodedTrackName = (filePath: string) =>
  filePath
    .split(".")
    .find((segment) => isEncodedTrackNameSegment(segment))

const roleMatchers = [
  {
    pattern: /\bcommentary\b/i,
    role: "Commentary",
  },
  {
    pattern: /\bforced\b/i,
    role: "Forced",
  },
  {
    pattern:
      /\bsigns?\b|\bsongs?\b|\bneps?\b|\bs&s\b|\btitles?\b/i,
    role: "Signs & Songs",
  },
] as const satisfies ReadonlyArray<{
  pattern: RegExp
  role: SubtitleTrackRole
}>

const editedMarkerPattern = /\(\s*edited by[^)]*\)/i

const editedHintPattern =
  /\bmodified\b|\bedited by\b|\bed\.\s*[^),\]]*/i

const noiseWordPattern =
  /^(ass|srt|sup|sub|subs|subtitle|subtitles|vobsub|pgs|textst|track|main|full|dialog|dialogue|english|eng|stylized|sign|signs|song|songs|nep|neps|title|titles|forced|commentary|complete|default|translation|only)$/i

const qualifierWordPattern =
  /^(sdh|cc|honorifics?|karaoke)$/i

const bracketedGroupPattern = /[[【]([^\]】]+)[\]】]/
const parentheticalPattern = /\(([^)]*)\)/g
const wordSeparatorPattern = /[\s:|@_]+/
const punctuationOnlyPattern = /^[^A-Za-z0-9]+$/

const stripEditedText = (text: string) =>
  text
    .replace(editedMarkerPattern, "")
    .replace(editedHintPattern, "")
    .trim()

const trimSeparators = (text: string) =>
  text.replace(/^[\s,;:/|-]+|[\s,;:/|-]+$/g, "").trim()

const compoundSeparatorPattern = /[/&+]/

const isNoiseWord = (word: string) =>
  word
    .split(compoundSeparatorPattern)
    .every(
      (part) =>
        part.length === 0 || noiseWordPattern.test(part),
    )

const stripNoiseWords = (text: string) =>
  text
    .split(wordSeparatorPattern)
    .filter(
      (word) =>
        word.length > 0 &&
        !punctuationOnlyPattern.test(word) &&
        !isNoiseWord(word),
    )
    .join(" ")

const cleanSegment = (text: string) =>
  trimSeparators(stripNoiseWords(stripEditedText(text)))

const bracketedGroupOf = (trackName: string) =>
  cleanSegment(
    (
      trackName.match(bracketedGroupPattern)?.[1] ?? ""
    ).replace(parentheticalPattern, ""),
  )

const bareGroupOf = (trackName: string) =>
  cleanSegment(
    trackName
      .replace(bracketedGroupPattern, "")
      .replace(parentheticalPattern, ""),
  )

const parentheticalsOf = (trackName: string) =>
  Array.from(trackName.matchAll(parentheticalPattern))
    .filter(([, inner]) => !editedHintPattern.test(inner))
    .map(([, inner]) => cleanSegment(inner))
    .filter((inner) => inner.length > 0)

const detectRole = (trackName: string) =>
  roleMatchers.find(({ pattern }) =>
    pattern.test(trackName),
  )?.role ?? "Full Subtitles"

const isQualifierWord = (candidate: string) =>
  qualifierWordPattern.test(candidate)

const candidatesOf = (trackName: string) =>
  [bracketedGroupOf(trackName), bareGroupOf(trackName)]
    .filter((candidate) => candidate.length > 0)
    .concat(parentheticalsOf(trackName))

const groupOf = (candidates: ReadonlyArray<string>) =>
  candidates.find(
    (candidate) => !isQualifierWord(candidate),
  ) ?? ""

const qualifierOf = (candidates: ReadonlyArray<string>) =>
  candidates.find(isQualifierWord) ??
  candidates.filter(
    (candidate) => !isQualifierWord(candidate),
  )[1] ??
  ""

export const isEditedTrackName = (trackName: string) =>
  editedMarkerPattern.test(trackName) ||
  editedHintPattern.test(trackName)

const composeName = ({
  group,
  isEdited,
  qualifier,
  role,
}: {
  group: string
  isEdited: boolean
  qualifier: string
  role: SubtitleTrackRole
}) =>
  [
    role,
    qualifier.length > 0 ? `(${qualifier})` : "",
    group.length > 0 ? `[${group}]` : "",
    isEdited ? editedBySuffix : "",
  ]
    .filter((part) => part.length > 0)
    .join(" ")

const buildNormalizedName = (trackName: string) =>
  composeName({
    group: groupOf(candidatesOf(trackName)),
    isEdited: isEditedTrackName(trackName),
    qualifier: qualifierOf(candidatesOf(trackName)),
    role: detectRole(trackName),
  })

export const normalizeSubtitleTrackName = (
  trackName: string,
) =>
  trackName.trim().length === 0
    ? ""
    : buildNormalizedName(trackName.trim())
