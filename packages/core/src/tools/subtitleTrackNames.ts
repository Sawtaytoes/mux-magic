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

export const ownerEditorName = "Sawtaytoes"

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

const editedMarkerPattern = /\(\s*edited(?: by[^)]*)?\)/i

// `ed. X` and `edited by X` always name an editor. `(X modified)` is
// ambiguous — X is the editor only when a group is named elsewhere,
// otherwise X is the group that was modified by someone unrecorded.
const namedEditorPatterns = [
  /\bed\.\s*([^)\],]+)/i,
  /\(\s*edited by\s+([^)]+)\)/i,
] as const

const modifiedParentheticalPattern =
  /\(([^)]+?)\s+modified\)/i

const editorAdverbPattern =
  /^(heavily|slightly|lightly|partially|further|slight|minor|major|fully|mostly)$/i

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
    .concat(
      baseGroupOf(trackName).length === 0
        ? [modifiedSubjectOf(trackName)].filter(
            (subject) => subject.length > 0,
          )
        : [],
    )

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

const splitEditorNames = (creditedText: string) =>
  creditedText
    .split(/\s+and\s+|,\s*/i)
    .map((editorName) => editorName.trim())
    .filter((editorName) => editorName.length > 0)

const baseGroupOf = (trackName: string) =>
  [
    bracketedGroupOf(trackName),
    bareGroupOf(trackName),
  ].find((candidate) => candidate.length > 0) ?? ""

const modifiedSubjectOf = (trackName: string) =>
  cleanSegment(
    trackName.match(modifiedParentheticalPattern)?.[1] ??
      "",
  )

export const findCreditedEditors = (trackName: string) =>
  namedEditorPatterns
    .flatMap((pattern) =>
      splitEditorNames(trackName.match(pattern)?.[1] ?? ""),
    )
    .concat(
      baseGroupOf(trackName).length > 0
        ? splitEditorNames(modifiedSubjectOf(trackName))
        : [],
    )
    .filter(
      (editorName) => !editorAdverbPattern.test(editorName),
    )
    .filter(
      (editorName, index, allNames) =>
        allNames.indexOf(editorName) === index,
    )

export const formatEditorList = (
  editorNames: ReadonlyArray<string>,
) =>
  editorNames.length <= 1
    ? editorNames.join("")
    : editorNames
        .slice(0, -1)
        .join(", ")
        .concat(
          " and ",
          editorNames[editorNames.length - 1],
        )

const buildEditedSuffix = (
  editorNames: ReadonlyArray<string>,
) =>
  editorNames.length > 0
    ? `(edited by ${formatEditorList(editorNames)})`
    : "(edited)"

const composeName = ({
  editorNames,
  group,
  isEdited,
  qualifier,
  role,
}: {
  editorNames: ReadonlyArray<string>
  group: string
  isEdited: boolean
  qualifier: string
  role: SubtitleTrackRole
}) =>
  [
    role,
    qualifier.length > 0 ? `(${qualifier})` : "",
    group.length > 0 ? `[${group}]` : "",
    isEdited ? buildEditedSuffix(editorNames) : "",
  ]
    .filter((part) => part.length > 0)
    .join(" ")

const buildNormalizedName = (trackName: string) =>
  composeName({
    editorNames: findCreditedEditors(trackName),
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

// Adding an editor is separate from normalizing, on purpose. A credited
// editor is provable from the name; that the OWNER edited a track is not —
// it is proved by comparing the track's text against the source release.
// Blindly appending the owner to every credited name would claim edits he
// never made.
export const addEditorToTrackName = ({
  editorName,
  trackName,
}: {
  editorName: string
  trackName: string
}) =>
  findCreditedEditors(trackName).includes(editorName)
    ? trackName
    : trackName.replace(editedMarkerPattern, "").trim()
          .length === trackName.trim().length
      ? `${trackName.trim()} (edited by ${editorName})`
      : `${trackName.replace(editedMarkerPattern, "").trim()} (edited by ${formatEditorList(
          findCreditedEditors(trackName).concat(editorName),
        )})`
