import { stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { vol } from "memfs"
import { firstValueFrom, of, throwError, toArray } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

vi.mock(
  "../cli-spawn-operations/runMkvExtractStdOut.js",
  () => ({
    runMkvExtractStdOut: vi.fn(),
  }),
)

vi.mock(
  "../cli-spawn-operations/writeChaptersMkvMerge.js",
  () => ({
    writeChaptersMkvMerge: vi.fn(),
  }),
)

const { runMkvExtractStdOut } = await import(
  "../cli-spawn-operations/runMkvExtractStdOut.js"
)
const { writeChaptersMkvMerge } = await import(
  "../cli-spawn-operations/writeChaptersMkvMerge.js"
)
const { renumberChapters } = await import(
  "./renumberChapters.js"
)

const buildChaptersXml = (
  chapterNames: ReadonlyArray<string>,
) => {
  const atomBlocks = chapterNames
    .map(
      (name, index) =>
        `    <ChapterAtom>\n` +
        `      <ChapterUID>${1000 + index}</ChapterUID>\n` +
        `      <ChapterTimeStart>00:0${index}:00.000000000</ChapterTimeStart>\n` +
        `      <ChapterTimeEnd>00:0${index + 1}:00.000000000</ChapterTimeEnd>\n` +
        `      <ChapterDisplay>\n` +
        `        <ChapterString>${name}</ChapterString>\n` +
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
    `    <EditionUID>9999</EditionUID>\n` +
    `${atomBlocks}\n` +
    `  </EditionEntry>\n` +
    `</Chapters>\n`
  )
}

const stubWriteChaptersMkvMergeWritingFile = () => {
  vi.mocked(writeChaptersMkvMerge).mockImplementation(
    ({
      outputFilePath,
    }: {
      chaptersXmlPath: string
      inputFilePath: string
      outputFilePath: string
    }) => {
      vol.writeFileSync(outputFilePath, "rewritten-mkv")
      return of(outputFilePath)
    },
  )
}

describe("renumberChapters", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vol.reset()
    // performRemux writes its temp XML under os.tmpdir() — ensure the
    // host temp dir exists inside memfs so the write doesn't ENOENT.
    vol.mkdirSync(tmpdir(), { recursive: true })
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  test("file with Chapter 08/09/10 → emits one renumbered result and calls writeChaptersMkvMerge exactly once", async () => {
    vol.fromJSON({
      "/work/episode.mkv": "source-mkv-bytes",
    })
    vi.mocked(runMkvExtractStdOut).mockReturnValue(
      of(
        buildChaptersXml([
          "Chapter 08",
          "Chapter 09",
          "Chapter 10",
        ]),
      ),
    )
    stubWriteChaptersMkvMergeWritingFile()

    const emissions = await firstValueFrom(
      renumberChapters({
        isPaddingChapterNumbers: true,
        isRecursive: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(emissions).toEqual([
      {
        action: "renumbered",
        filePath: join("/work", "episode.mkv"),
        renamedCount: 3,
      },
    ])
    expect(writeChaptersMkvMerge).toHaveBeenCalledTimes(1)
    // Original file replaced atomically — the renumbered bytes now live
    // at the source path.
    expect(
      vol.readFileSync("/work/episode.mkv", "utf8"),
    ).toBe("rewritten-mkv")
  })

  test("file with already-sequential chapters → emits already-sequential and does NOT call writeChaptersMkvMerge", async () => {
    vol.fromJSON({
      "/work/episode.mkv": "source-mkv-bytes",
    })
    vi.mocked(runMkvExtractStdOut).mockReturnValue(
      of(
        buildChaptersXml([
          "Chapter 01",
          "Chapter 02",
          "Chapter 03",
        ]),
      ),
    )

    const emissions = await firstValueFrom(
      renumberChapters({
        isPaddingChapterNumbers: true,
        isRecursive: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(emissions).toEqual([
      {
        action: "already-sequential",
        filePath: join("/work", "episode.mkv"),
      },
    ])
    expect(writeChaptersMkvMerge).not.toHaveBeenCalled()
    // Original file untouched on the already-sequential fast path.
    expect(
      vol.readFileSync("/work/episode.mkv", "utf8"),
    ).toBe("source-mkv-bytes")
  })

  test("file with no chapters → emits skipped with reason no-chapters", async () => {
    vol.fromJSON({
      "/work/episode.mkv": "source-mkv-bytes",
    })
    vi.mocked(runMkvExtractStdOut).mockReturnValue(
      of(buildChaptersXml([])),
    )

    const emissions = await firstValueFrom(
      renumberChapters({
        isPaddingChapterNumbers: true,
        isRecursive: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(emissions).toEqual([
      {
        action: "skipped",
        filePath: join("/work", "episode.mkv"),
        reason: "no-chapters",
      },
    ])
    expect(writeChaptersMkvMerge).not.toHaveBeenCalled()
  })

  test("file whose chapters are all custom names → emits skipped with reason no-numbered-chapters; does NOT call writeChaptersMkvMerge", async () => {
    vol.fromJSON({
      "/work/episode.mkv": "source-mkv-bytes",
    })
    vi.mocked(runMkvExtractStdOut).mockReturnValue(
      of(
        buildChaptersXml([
          "Opening",
          "Part A",
          "Ending",
        ]),
      ),
    )

    const emissions = await firstValueFrom(
      renumberChapters({
        isPaddingChapterNumbers: true,
        isRecursive: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(emissions).toEqual([
      {
        action: "skipped",
        filePath: join("/work", "episode.mkv"),
        reason: "no-numbered-chapters",
      },
    ])
    expect(writeChaptersMkvMerge).not.toHaveBeenCalled()
  })

  test("file with partially-mixed chapter names → emits skipped with reason mixed-chapter-names", async () => {
    vol.fromJSON({
      "/work/episode.mkv": "source-mkv-bytes",
    })
    vi.mocked(runMkvExtractStdOut).mockReturnValue(
      of(
        buildChaptersXml([
          "Chapter 01",
          "Opening",
          "Chapter 03",
        ]),
      ),
    )

    const emissions = await firstValueFrom(
      renumberChapters({
        isPaddingChapterNumbers: true,
        isRecursive: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(emissions).toEqual([
      {
        action: "skipped",
        filePath: join("/work", "episode.mkv"),
        reason: "mixed-chapter-names",
      },
    ])
    expect(writeChaptersMkvMerge).not.toHaveBeenCalled()
  })

  test("non-video files are filtered out before mkvextract sees them", async () => {
    vol.fromJSON({
      "/work/notes.txt": "ignore me",
      "/work/episode.mkv": "source-mkv-bytes",
    })
    vi.mocked(runMkvExtractStdOut).mockReturnValue(
      of(
        buildChaptersXml([
          "Chapter 01",
          "Chapter 02",
        ]),
      ),
    )

    await firstValueFrom(
      renumberChapters({
        isPaddingChapterNumbers: true,
        isRecursive: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    // mkvextract was only invoked once — for the .mkv file, never for .txt.
    expect(runMkvExtractStdOut).toHaveBeenCalledTimes(1)
  })

  test("cross-device rename failure (EXDEV) falls back to copy+unlink without losing the file", async () => {
    vol.fromJSON({
      "/work/episode.mkv": "source-mkv-bytes",
    })
    vi.mocked(runMkvExtractStdOut).mockReturnValue(
      of(
        buildChaptersXml([
          "Chapter 08",
          "Chapter 09",
        ]),
      ),
    )
    stubWriteChaptersMkvMergeWritingFile()

    // Force rename to throw EXDEV the first time — copy-fallback should run.
    const fsPromises = await import("node:fs/promises")
    const renameSpy = vi
      .spyOn(fsPromises, "rename")
      .mockImplementationOnce(() => {
        const exdevError = new Error(
          "EXDEV: cross-device link not permitted",
        ) as NodeJS.ErrnoException
        exdevError.code = "EXDEV"
        return Promise.reject(exdevError)
      })

    const emissions = await firstValueFrom(
      renumberChapters({
        isPaddingChapterNumbers: true,
        isRecursive: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    expect(emissions).toEqual([
      {
        action: "renumbered",
        filePath: join("/work", "episode.mkv"),
        renamedCount: 2,
      },
    ])
    expect(renameSpy).toHaveBeenCalled()
    // File still exists at the original location with the rewritten bytes.
    await expect(
      stat("/work/episode.mkv"),
    ).resolves.toBeDefined()
    expect(
      vol.readFileSync("/work/episode.mkv", "utf8"),
    ).toBe("rewritten-mkv")

    renameSpy.mockRestore()
  })

  test("when mkvextract itself errors, swallows per-file and continues (other files still get processed)", async () => {
    vol.fromJSON({
      "/work/broken.mkv": "broken-mkv-bytes",
      "/work/good.mkv": "good-mkv-bytes",
    })
    vi.spyOn(console, "error").mockImplementation(() => {})

    // Per-file response keyed by input path — robust to filesystem
    // listing order (getFilesAtDepth doesn't guarantee alphabetical).
    vi.mocked(runMkvExtractStdOut).mockImplementation(
      ({ args }: { args: string[] }) => {
        const filePath = args[args.length - 1]
        if (filePath.includes("broken")) {
          return throwError(
            () => new Error("mkvextract crashed"),
          )
        }
        return of(
          buildChaptersXml([
            "Chapter 05",
            "Chapter 06",
          ]),
        )
      },
    )
    stubWriteChaptersMkvMergeWritingFile()

    const emissions = await firstValueFrom(
      renumberChapters({
        isPaddingChapterNumbers: true,
        isRecursive: false,
        sourcePath: "/work",
      }).pipe(toArray()),
    )

    // The good file still gets a result; the broken one is dropped.
    const renumberedActions = emissions.filter(
      (emission) =>
        (emission as { action: string }).action ===
        "renumbered",
    )
    expect(renumberedActions.length).toBe(1)
  })
})
