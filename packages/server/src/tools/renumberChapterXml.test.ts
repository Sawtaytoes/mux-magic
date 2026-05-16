import { describe, expect, test } from "vitest"

import { renumberChapterXml } from "./renumberChapterXml.js"

const buildChaptersXml = (
  atoms: Array<{
    name: string
    uid: string
    timeStart: string
    timeEnd: string
  }>,
) => {
  const atomBlocks = atoms
    .map(
      (atom) =>
        `    <ChapterAtom>\n` +
        `      <ChapterUID>${atom.uid}</ChapterUID>\n` +
        `      <ChapterTimeStart>${atom.timeStart}</ChapterTimeStart>\n` +
        `      <ChapterTimeEnd>${atom.timeEnd}</ChapterTimeEnd>\n` +
        `      <ChapterDisplay>\n` +
        `        <ChapterString>${atom.name}</ChapterString>\n` +
        `        <ChapterLanguage>eng</ChapterLanguage>\n` +
        `      </ChapterDisplay>\n` +
        `    </ChapterAtom>`,
    )
    .join("\n")
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE Chapters SYSTEM "matroskachapters.dtd">\n` +
    `<Chapters>\n` +
    `  <EditionEntry>\n` +
    `    <EditionFlagHidden>0</EditionFlagHidden>\n` +
    `    <EditionFlagDefault>0</EditionFlagDefault>\n` +
    `    <EditionUID>9999999</EditionUID>\n` +
    `${atomBlocks}\n` +
    `  </EditionEntry>\n` +
    `</Chapters>\n`
  )
}

const extractChapterNames = (xml: string) => (
  Array.from(
    xml.matchAll(/<ChapterString>([^<]*)<\/ChapterString>/g),
  ).map((match) => match[1])
)

describe("renumberChapterXml", () => {
  test("split-source case: 3 atoms named Chapter 08/09/10 → renumbered to 01/02/03", () => {
    const inputXml = buildChaptersXml([
      {
        name: "Chapter 08",
        uid: "1001",
        timeStart: "00:00:00.000000000",
        timeEnd: "00:08:00.000000000",
      },
      {
        name: "Chapter 09",
        uid: "1002",
        timeStart: "00:08:00.000000000",
        timeEnd: "00:16:00.000000000",
      },
      {
        name: "Chapter 10",
        uid: "1003",
        timeStart: "00:16:00.000000000",
        timeEnd: "00:24:00.000000000",
      },
    ])

    const result = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: inputXml,
    })

    expect(result.status).toBe("renumbered")
    expect(result.renamedCount).toBe(3)
    expect(extractChapterNames(result.xml)).toEqual([
      "Chapter 01",
      "Chapter 02",
      "Chapter 03",
    ])
  })

  test("combined-source case: 6 atoms 01/02/03/01/02/03 → renumbered to 01..06; renamedCount === 3", () => {
    const inputXml = buildChaptersXml([
      {
        name: "Chapter 01",
        uid: "2001",
        timeStart: "00:00:00.000000000",
        timeEnd: "00:08:00.000000000",
      },
      {
        name: "Chapter 02",
        uid: "2002",
        timeStart: "00:08:00.000000000",
        timeEnd: "00:16:00.000000000",
      },
      {
        name: "Chapter 03",
        uid: "2003",
        timeStart: "00:16:00.000000000",
        timeEnd: "00:24:00.000000000",
      },
      {
        name: "Chapter 01",
        uid: "2004",
        timeStart: "00:24:00.000000000",
        timeEnd: "00:32:00.000000000",
      },
      {
        name: "Chapter 02",
        uid: "2005",
        timeStart: "00:32:00.000000000",
        timeEnd: "00:40:00.000000000",
      },
      {
        name: "Chapter 03",
        uid: "2006",
        timeStart: "00:40:00.000000000",
        timeEnd: "00:48:00.000000000",
      },
    ])

    const result = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: inputXml,
    })

    expect(result.status).toBe("renumbered")
    expect(result.renamedCount).toBe(3)
    expect(extractChapterNames(result.xml)).toEqual([
      "Chapter 01",
      "Chapter 02",
      "Chapter 03",
      "Chapter 04",
      "Chapter 05",
      "Chapter 06",
    ])
  })

  test("mixed case: Chapter 01, Opening, Chapter 03 → status mixed, XML returned unchanged", () => {
    const inputXml = buildChaptersXml([
      {
        name: "Chapter 01",
        uid: "3001",
        timeStart: "00:00:00.000000000",
        timeEnd: "00:08:00.000000000",
      },
      {
        name: "Opening",
        uid: "3002",
        timeStart: "00:08:00.000000000",
        timeEnd: "00:16:00.000000000",
      },
      {
        name: "Chapter 03",
        uid: "3003",
        timeStart: "00:16:00.000000000",
        timeEnd: "00:24:00.000000000",
      },
    ])

    const result = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: inputXml,
    })

    expect(result.status).toBe("mixed")
    expect(result.xml).toBe(inputXml)
  })

  test("all-custom case: all atoms are custom names → status mixed, XML unchanged", () => {
    const inputXml = buildChaptersXml([
      {
        name: "Opening",
        uid: "4001",
        timeStart: "00:00:00.000000000",
        timeEnd: "00:08:00.000000000",
      },
      {
        name: "Part A",
        uid: "4002",
        timeStart: "00:08:00.000000000",
        timeEnd: "00:16:00.000000000",
      },
      {
        name: "Ending",
        uid: "4003",
        timeStart: "00:16:00.000000000",
        timeEnd: "00:24:00.000000000",
      },
    ])

    const result = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: inputXml,
    })

    expect(result.status).toBe("mixed")
    expect(result.xml).toBe(inputXml)
  })

  test("already-sequential case: Chapter 01..03 → status already-sequential, renamedCount 0", () => {
    const inputXml = buildChaptersXml([
      {
        name: "Chapter 01",
        uid: "5001",
        timeStart: "00:00:00.000000000",
        timeEnd: "00:08:00.000000000",
      },
      {
        name: "Chapter 02",
        uid: "5002",
        timeStart: "00:08:00.000000000",
        timeEnd: "00:16:00.000000000",
      },
      {
        name: "Chapter 03",
        uid: "5003",
        timeStart: "00:16:00.000000000",
        timeEnd: "00:24:00.000000000",
      },
    ])

    const result = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: inputXml,
    })

    expect(result.status).toBe("already-sequential")
    expect(result.renamedCount).toBe(0)
  })

  test("timecodes are preserved byte-identical when status is renumbered", () => {
    const inputXml = buildChaptersXml([
      {
        name: "Chapter 05",
        uid: "6001",
        timeStart: "00:00:00.123456789",
        timeEnd: "00:08:42.987654321",
      },
      {
        name: "Chapter 06",
        uid: "6002",
        timeStart: "00:08:42.987654321",
        timeEnd: "00:17:25.555555555",
      },
    ])

    const result = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: inputXml,
    })

    expect(result.status).toBe("renumbered")
    expect(
      result.xml.includes(
        "<ChapterTimeStart>00:00:00.123456789</ChapterTimeStart>",
      ),
    ).toBe(true)
    expect(
      result.xml.includes(
        "<ChapterTimeEnd>00:08:42.987654321</ChapterTimeEnd>",
      ),
    ).toBe(true)
    expect(
      result.xml.includes(
        "<ChapterTimeStart>00:08:42.987654321</ChapterTimeStart>",
      ),
    ).toBe(true)
    expect(
      result.xml.includes(
        "<ChapterTimeEnd>00:17:25.555555555</ChapterTimeEnd>",
      ),
    ).toBe(true)
  })

  test("ChapterUID values are preserved even when duplicated (multi-disc join)", () => {
    const inputXml = buildChaptersXml([
      {
        name: "Chapter 01",
        uid: "7777",
        timeStart: "00:00:00.000000000",
        timeEnd: "00:08:00.000000000",
      },
      {
        name: "Chapter 02",
        uid: "8888",
        timeStart: "00:08:00.000000000",
        timeEnd: "00:16:00.000000000",
      },
      {
        name: "Chapter 01",
        uid: "7777",
        timeStart: "00:16:00.000000000",
        timeEnd: "00:24:00.000000000",
      },
      {
        name: "Chapter 02",
        uid: "8888",
        timeStart: "00:24:00.000000000",
        timeEnd: "00:32:00.000000000",
      },
    ])

    const result = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: inputXml,
    })

    const uidValues = Array.from(
      result.xml.matchAll(
        /<ChapterUID>([^<]+)<\/ChapterUID>/g,
      ),
    ).map((match) => match[1])

    expect(uidValues).toEqual([
      "7777",
      "8888",
      "7777",
      "8888",
    ])
  })

  test("zero-padding width follows total atom count: 12 atoms → 01..12", () => {
    const atoms = Array.from(
      { length: 12 },
      (_unused, index) => ({
        name: `Chapter ${index + 1}`,
        uid: `${9000 + index}`,
        timeStart: "00:00:00.000000000",
        timeEnd: "00:01:00.000000000",
      }),
    )
    const inputXml = buildChaptersXml(atoms)

    const result = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: inputXml,
    })

    expect(result.status).toBe("renumbered")
    expect(extractChapterNames(result.xml)).toEqual([
      "Chapter 01",
      "Chapter 02",
      "Chapter 03",
      "Chapter 04",
      "Chapter 05",
      "Chapter 06",
      "Chapter 07",
      "Chapter 08",
      "Chapter 09",
      "Chapter 10",
      "Chapter 11",
      "Chapter 12",
    ])
  })

  test("zero-padding width follows total atom count: 100 atoms → 001..100", () => {
    const atoms = Array.from(
      { length: 100 },
      (_unused, index) => ({
        name: `Chapter ${index + 1}`,
        uid: `${10000 + index}`,
        timeStart: "00:00:00.000000000",
        timeEnd: "00:00:01.000000000",
      }),
    )
    const inputXml = buildChaptersXml(atoms)

    const result = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: inputXml,
    })

    const chapterNames = extractChapterNames(result.xml)
    expect(result.status).toBe("renumbered")
    expect(chapterNames[0]).toBe("Chapter 001")
    expect(chapterNames[8]).toBe("Chapter 009")
    expect(chapterNames[9]).toBe("Chapter 010")
    expect(chapterNames[99]).toBe("Chapter 100")
    expect(chapterNames.length).toBe(100)
  })

  test("no padding when isPaddingChapterNumbers is false: 12 atoms → Chapter 1..12 (unpadded)", () => {
    const atoms = Array.from(
      { length: 12 },
      (_unused, index) => ({
        name: `Chapter ${index + 5}`,
        uid: `${11000 + index}`,
        timeStart: "00:00:00.000000000",
        timeEnd: "00:01:00.000000000",
      }),
    )
    const inputXml = buildChaptersXml(atoms)

    const result = renumberChapterXml({
      isPaddingChapterNumbers: false,
      xml: inputXml,
    })

    expect(result.status).toBe("renumbered")
    const chapterNames = extractChapterNames(result.xml)
    expect(chapterNames[0]).toBe("Chapter 1")
    expect(chapterNames[8]).toBe("Chapter 9")
    expect(chapterNames[9]).toBe("Chapter 10")
    expect(chapterNames[11]).toBe("Chapter 12")
  })

  test("mixed result exposes matchedCount and totalCount so callers can distinguish all-custom from partially-mixed", () => {
    const partiallyMixed = buildChaptersXml([
      {
        name: "Chapter 01",
        uid: "12001",
        timeStart: "00:00:00.000000000",
        timeEnd: "00:08:00.000000000",
      },
      {
        name: "Opening",
        uid: "12002",
        timeStart: "00:08:00.000000000",
        timeEnd: "00:16:00.000000000",
      },
    ])
    const allCustom = buildChaptersXml([
      {
        name: "Opening",
        uid: "13001",
        timeStart: "00:00:00.000000000",
        timeEnd: "00:08:00.000000000",
      },
      {
        name: "Ending",
        uid: "13002",
        timeStart: "00:08:00.000000000",
        timeEnd: "00:16:00.000000000",
      },
    ])

    const partiallyMixedResult = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: partiallyMixed,
    })
    const allCustomResult = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: allCustom,
    })

    expect(partiallyMixedResult.status).toBe("mixed")
    expect(partiallyMixedResult.matchedCount).toBe(1)
    expect(partiallyMixedResult.totalCount).toBe(2)
    expect(allCustomResult.status).toBe("mixed")
    expect(allCustomResult.matchedCount).toBe(0)
    expect(allCustomResult.totalCount).toBe(2)
  })

  test("zero-atom input (no ChapterAtom elements) → status no-chapters", () => {
    const emptyXml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!DOCTYPE Chapters SYSTEM "matroskachapters.dtd">\n` +
      `<Chapters>\n` +
      `  <EditionEntry>\n` +
      `    <EditionUID>1</EditionUID>\n` +
      `  </EditionEntry>\n` +
      `</Chapters>\n`

    const result = renumberChapterXml({
      isPaddingChapterNumbers: true,
      xml: emptyXml,
    })

    expect(result.status).toBe("no-chapters")
  })
})
