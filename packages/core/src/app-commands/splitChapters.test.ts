import { tmpdir } from "node:os"
import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, of, toArray } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

// Same rationale as renumberChapters.test.ts: every cli-spawn-operations/*
// module spawns a real mkvtoolnix binary, so vitest.setup.ts auto-mocks
// the whole folder. Import the already-mocked symbols directly.
const { splitChaptersMkvMerge } = await import(
  "../cli-spawn-operations/splitChaptersMkvMerge.js"
)
const { runMkvExtractStdOut } = await import(
  "../cli-spawn-operations/runMkvExtractStdOut.js"
)
const { writeChaptersMkvMerge } = await import(
  "../cli-spawn-operations/writeChaptersMkvMerge.js"
)
const { splitChapters } = await import("./splitChapters.js")

const buildChaptersXml = (
  chapterNames: ReadonlyArray<string>,
) => {
  const atomBlocks = chapterNames
    .map(
      (name, index) =>
        `    <ChapterAtom>\n` +
        `      <ChapterUID>${1000 + index}</ChapterUID>\n` +
        `      <ChapterTimeStart>00:0${index}:00.000000000</ChapterTimeStart>\n` +
        `      <ChapterDisplay>\n` +
        `        <ChapterString>${name}</ChapterString>\n` +
        `      </ChapterDisplay>\n` +
        `    </ChapterAtom>`,
    )
    .join("\n")
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Chapters>\n` +
    `  <EditionEntry>\n` +
    `${atomBlocks}\n` +
    `  </EditionEntry>\n` +
    `</Chapters>\n`
  )
}

const splitsFolderPath = join("/work", "SPLITS")

// mkvmerge never writes the --output path when --split is in play; it
// writes `<stem>-001.mkv`, `<stem>-002.mkv`, … beside it. Reproduce that
// so the command has real part files to find.
const stubSplitWritingParts = (partCount: number) => {
  vi.mocked(splitChaptersMkvMerge).mockImplementation(
    ({ filePath }: { filePath: string }) => {
      const outputFilePath = join(
        splitsFolderPath,
        "volume.mkv",
      )
      vol.mkdirSync(splitsFolderPath, { recursive: true })
      Array.from({ length: partCount }).forEach(
        (_unused, partIndex) => {
          vol.writeFileSync(
            join(
              splitsFolderPath,
              `volume-00${partIndex + 1}.mkv`,
            ),
            `part-of-${filePath}`,
          )
        },
      )
      return of(outputFilePath)
    },
  )
}

// The command deletes its temp chapter XML in a `finally`, so read it
// here — inside the spawn-op stub — while it still exists.
const stubWriteChaptersMkvMergeCapturingXml = () => {
  const capturedXmls: string[] = []
  vi.mocked(writeChaptersMkvMerge).mockImplementation(
    ({
      chaptersXmlPath,
      outputFilePath,
    }: {
      chaptersXmlPath: string
      inputFilePath: string
      outputFilePath: string
    }) => {
      capturedXmls.push(
        vol.readFileSync(chaptersXmlPath, "utf8") as string,
      )
      vol.writeFileSync(outputFilePath, "renumbered-mkv")
      return of(outputFilePath)
    },
  )
  return capturedXmls
}

describe("splitChapters", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vol.reset()
    // The renumber step writes its temp XML under os.tmpdir().
    vol.mkdirSync(tmpdir(), { recursive: true })
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  test("renumbers each split part so its chapters start at 1", async () => {
    vol.fromJSON({ "/work/volume.mkv": "source-mkv" })
    stubSplitWritingParts(2)
    // Part 1 keeps the play-all numbering it inherited, part 2 starts at
    // Chapter 04 — the bug this command now fixes on the way out.
    vi.mocked(runMkvExtractStdOut)
      .mockReturnValueOnce(
        of(
          buildChaptersXml([
            "Chapter 01",
            "Chapter 02",
            "Chapter 03",
          ]),
        ),
      )
      .mockReturnValueOnce(
        of(
          buildChaptersXml([
            "Chapter 04",
            "Chapter 05",
            "Chapter 06",
          ]),
        ),
      )
    const capturedXmls =
      stubWriteChaptersMkvMergeCapturingXml()

    await firstValueFrom(
      splitChapters({
        chapterSplitsList: ["4"],
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    // Only part 2 needed rewriting; part 1 was already sequential, so it
    // never reaches mkvmerge.
    expect(writeChaptersMkvMerge).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(writeChaptersMkvMerge).mock.calls[0][0]
        .inputFilePath,
    ).toBe(join(splitsFolderPath, "volume-002.mkv"))
    const rewrittenXml = capturedXmls[0]
    expect(rewrittenXml).toContain(
      "<ChapterString>Chapter 01</ChapterString>",
    )
    expect(rewrittenXml).not.toContain(
      "<ChapterString>Chapter 04</ChapterString>",
    )
  })

  test("leaves the parts alone when renumbering is turned off", async () => {
    vol.fromJSON({ "/work/volume.mkv": "source-mkv" })
    stubSplitWritingParts(2)

    await firstValueFrom(
      splitChapters({
        chapterSplitsList: ["4"],
        isRenumberingChapters: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(runMkvExtractStdOut).not.toHaveBeenCalled()
    expect(writeChaptersMkvMerge).not.toHaveBeenCalled()
  })

  test("skips a part whose chapters carry custom names", async () => {
    vol.fromJSON({ "/work/volume.mkv": "source-mkv" })
    stubSplitWritingParts(1)
    vi.mocked(runMkvExtractStdOut).mockReturnValue(
      of(
        buildChaptersXml([
          "Chapter 04",
          "Opening",
          "Chapter 06",
        ]),
      ),
    )

    await firstValueFrom(
      splitChapters({
        chapterSplitsList: ["4"],
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(writeChaptersMkvMerge).not.toHaveBeenCalled()
  })
})
