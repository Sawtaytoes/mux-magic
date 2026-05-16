// Pure rewriter for the chapter-XML round-trip mkvmerge consumes.
//
// All-or-nothing rule: every <ChapterAtom>'s first <ChapterString> must
// match `Chapter NN` for a rewrite to happen; one non-matching atom flips
// the result to "mixed" and the XML is returned unchanged so the caller
// skips the file rather than guess intent.

const CHAPTER_NAME_PATTERN = /^Chapter\s+\d+$/i
const ATOM_REGEX = /<ChapterAtom>[\s\S]*?<\/ChapterAtom>/g
const FIRST_CHAPTER_STRING_REGEX =
  /<ChapterString>([^<]*)<\/ChapterString>/

export type RenumberChapterXmlStatus =
  | "renumbered"
  | "already-sequential"
  | "mixed"
  | "no-chapters"

export type RenumberChapterXmlResult = {
  matchedCount: number
  renamedCount: number
  status: RenumberChapterXmlStatus
  totalCount: number
  xml: string
}

const padChapterNumber = ({
  isPaddingChapterNumbers,
  totalCount,
  value,
}: {
  isPaddingChapterNumbers: boolean
  totalCount: number
  value: number
}) => (
  isPaddingChapterNumbers
    ? String(value).padStart(
        Math.max(2, String(totalCount).length),
        "0",
      )
    : String(value)
)

const extractFirstChapterString = (
  atomXml: string,
): string | null => {
  const match = atomXml.match(FIRST_CHAPTER_STRING_REGEX)
  return match === null ? null : match[1]
}

const buildRewrittenXml = ({
  atomMatches,
  newNames,
  xml,
}: {
  atomMatches: ReadonlyArray<RegExpMatchArray>
  newNames: ReadonlyArray<string>
  xml: string
}) => {
  const stitched = atomMatches.reduce(
    (accumulator, atomMatch, atomIndex) => ({
      output:
        accumulator.output +
        xml.slice(
          accumulator.position,
          atomMatch.index ?? 0,
        ) +
        atomMatch[0].replace(
          FIRST_CHAPTER_STRING_REGEX,
          `<ChapterString>${newNames[atomIndex]}</ChapterString>`,
        ),
      position:
        (atomMatch.index ?? 0) + atomMatch[0].length,
    }),
    { output: "", position: 0 },
  )
  return stitched.output + xml.slice(stitched.position)
}

const computeStatus = ({
  matchedCount,
  renamedCount,
  totalCount,
}: {
  matchedCount: number
  renamedCount: number
  totalCount: number
}): RenumberChapterXmlStatus => (
  totalCount === 0
    ? "no-chapters"
    : matchedCount < totalCount
      ? "mixed"
      : renamedCount === 0
        ? "already-sequential"
        : "renumbered"
)

export const renumberChapterXml = ({
  isPaddingChapterNumbers,
  xml,
}: {
  isPaddingChapterNumbers: boolean
  xml: string
}): RenumberChapterXmlResult => {
  const atomMatches = Array.from(xml.matchAll(ATOM_REGEX))
  const totalCount = atomMatches.length
  const currentNames = atomMatches.map((atomMatch) =>
    extractFirstChapterString(atomMatch[0]),
  )
  const matchedCount = currentNames.filter(
    (name) =>
      name !== null && CHAPTER_NAME_PATTERN.test(name),
  ).length
  const newNames = atomMatches.map((_atomMatch, atomIndex) =>
    "Chapter ".concat(
      padChapterNumber({
        isPaddingChapterNumbers,
        totalCount,
        value: atomIndex + 1,
      }),
    ),
  )
  const renamedCount = newNames.filter(
    (newName, atomIndex) =>
      newName !== currentNames[atomIndex],
  ).length
  const status = computeStatus({
    matchedCount,
    renamedCount,
    totalCount,
  })
  return {
    matchedCount:
      status === "no-chapters" ? 0 : matchedCount,
    renamedCount:
      status === "renumbered" ? renamedCount : 0,
    status,
    totalCount,
    xml:
      status === "renumbered"
        ? buildRewrittenXml({
            atomMatches,
            newNames,
            xml,
          })
        : xml,
  }
}
