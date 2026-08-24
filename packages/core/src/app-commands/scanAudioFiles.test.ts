import { vol } from "memfs"
import { firstValueFrom } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { readAudioTags } from "../music/tags/readAudioTags.js"
import {
  isAudioFilePath,
  scanAudioFiles,
} from "./scanAudioFiles.js"

// The tag reader parses real container bytes, which memfs fixtures do not
// have. Mocking it keeps this test about the walk, the extension filter and
// the unreadable-file path — `readAudioTags` has its own tests against
// ffmpeg-generated fixtures.
vi.mock("../music/tags/readAudioTags.js", () => ({
  readAudioTags: vi.fn(),
}))

const buildReadResult = (title: string) => ({
  info: {
    codec: "FLAC",
    durationSeconds: 210,
    fileSizeBytes: 1024,
    hasEmbeddedCoverArt: false,
    filePath: "",
    sampleRate: 44_100,
  },
  tags: { title },
})

describe(isAudioFilePath.name, () => {
  test("accepts the audio extensions and rejects everything else, keyed off the PATH not the stem", () => {
    expect(isAudioFilePath("/inbox/track.flac")).toBe(true)
    expect(isAudioFilePath("/inbox/track.MP3")).toBe(true)
    expect(isAudioFilePath("/inbox/cover.jpg")).toBe(false)
    expect(isAudioFilePath("/inbox/movie.mkv")).toBe(false)
  })
})

describe(scanAudioFiles.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.mocked(readAudioTags).mockReset()
  })

  test("reports one scanned row per audio file and ignores everything else", async () => {
    vol.fromJSON({
      "/inbox/01.flac": "x",
      "/inbox/02.flac": "x",
      "/inbox/cover.jpg": "x",
      "/inbox/notes.txt": "x",
    })
    vi.mocked(readAudioTags).mockImplementation(
      (filePath: string) =>
        Promise.resolve(buildReadResult(filePath)),
    )

    const records = await firstValueFrom(
      scanAudioFiles({ sourcePath: "/inbox" }),
    )

    expect(
      records.map((record) => record.filename).toSorted(),
    ).toEqual(["01.flac", "02.flac"])
    expect(
      records.every((record) => record.kind === "scanned"),
    ).toBe(true)
  })

  // Regression: the shared walk's `FileInfo.filename` is the stem with the
  // extension already stripped, so both the extension filter and this field
  // must come off the full path. Keying either off `filename` matched
  // nothing and reported every folder as empty.
  test("each row carries the real filename, extension included", async () => {
    vol.fromJSON({
      "/inbox/01 - Bring the Noise.flac": "x",
    })
    vi.mocked(readAudioTags).mockImplementation(
      (filePath: string) =>
        Promise.resolve(buildReadResult(filePath)),
    )

    const records = await firstValueFrom(
      scanAudioFiles({ sourcePath: "/inbox" }),
    )

    expect(records[0]).toMatchObject({
      extension: ".flac",
      filename: "01 - Bring the Noise.flac",
    })
  })

  test("a file the parser cannot read becomes one unreadable row, and the rest still scan", async () => {
    vol.fromJSON({
      "/inbox/good.flac": "x",
      "/inbox/truncated.flac": "x",
    })
    vi.mocked(readAudioTags).mockImplementation(
      (filePath: string) =>
        filePath.endsWith("truncated.flac")
          ? Promise.reject(
              new Error("Unexpected end of file"),
            )
          : Promise.resolve(buildReadResult(filePath)),
    )

    const records = await firstValueFrom(
      scanAudioFiles({ sourcePath: "/inbox" }),
    )

    expect(records).toHaveLength(2)
    expect(
      records.find(
        (record) => record.filename === "truncated.flac",
      ),
    ).toMatchObject({
      kind: "unreadable",
      reason: "Unexpected end of file",
    })
    expect(
      records.find(
        (record) => record.filename === "good.flac",
      )?.kind,
    ).toBe("scanned")
  })

  test("child folders are skipped unless the walk is told to be recursive", async () => {
    vol.fromJSON({
      "/inbox/album/01.flac": "x",
      "/inbox/top.flac": "x",
    })
    vi.mocked(readAudioTags).mockImplementation(
      (filePath: string) =>
        Promise.resolve(buildReadResult(filePath)),
    )

    expect(
      await firstValueFrom(
        scanAudioFiles({ sourcePath: "/inbox" }),
      ),
    ).toHaveLength(1)

    expect(
      await firstValueFrom(
        scanAudioFiles({
          isRecursive: true,
          sourcePath: "/inbox",
        }),
      ),
    ).toHaveLength(2)
  })

  test("an empty folder is an empty row set, not a failure", async () => {
    vol.fromJSON({ "/inbox/.keep": "" })

    expect(
      await firstValueFrom(
        scanAudioFiles({ sourcePath: "/inbox" }),
      ),
    ).toEqual([])
  })
})
