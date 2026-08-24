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
import { writeAudioTags as writeTagsToFile } from "../music/tags/writeAudioTags.js"
import {
  getChangedTagFields,
  writeAudioTags,
} from "./writeAudioTags.js"

vi.mock("../music/tags/readAudioTags.js", () => ({
  readAudioTags: vi.fn(),
}))
vi.mock("../music/tags/writeAudioTags.js", () => ({
  writeAudioTags: vi.fn(),
}))

const mockCurrentTags = (
  tagsByPath: Record<string, Record<string, unknown>>,
) => {
  vi.mocked(readAudioTags).mockImplementation(
    (filePath: string) =>
      Promise.resolve({
        info: {
          fileSizeBytes: 1024,
          filePath,
          hasEmbeddedCoverArt: false,
        },
        tags: tagsByPath[filePath] ?? {},
      } as Awaited<ReturnType<typeof readAudioTags>>),
  )
}

describe(getChangedTagFields.name, () => {
  test("only the fields the caller set are compared", () => {
    expect(
      getChangedTagFields({
        currentTags: {
          album: "Old Album",
          artist: "Keep Me",
        },
        tags: { album: "New Album" },
      }),
    ).toEqual(["album"])
  })

  test("a field already carrying the value is not a change", () => {
    expect(
      getChangedTagFields({
        currentTags: { albumArtist: "Public Enemy" },
        tags: { albumArtist: "Public Enemy" },
      }),
    ).toEqual([])
  })

  test("an empty string is an explicit clear, not an absent field", () => {
    expect(
      getChangedTagFields({
        currentTags: { comment: "ripped 2004" },
        tags: { comment: "" },
      }),
    ).toEqual(["comment"])
  })
})

describe(writeAudioTags.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.mocked(readAudioTags).mockReset()
    vi.mocked(writeTagsToFile).mockReset()
    vi.mocked(writeTagsToFile).mockResolvedValue(undefined)
  })

  test("writes the tag set to every audio file and names the changed fields", async () => {
    vol.fromJSON({
      "/inbox/01.flac": "x",
      "/inbox/02.flac": "x",
    })
    mockCurrentTags({})

    const records = await firstValueFrom(
      writeAudioTags({
        sourcePath: "/inbox",
        tags: { albumArtist: "Public Enemy" },
      }),
    )

    expect(records).toHaveLength(2)
    expect(
      records.every(
        (record) =>
          record.kind === "written" &&
          record.changedFields.includes("albumArtist"),
      ),
    ).toBe(true)
    expect(writeTagsToFile).toHaveBeenCalledTimes(2)
  })

  // The acceptance test from docs/picard-parity.md §10, at the tag level:
  // a second run over an already-correct folder must touch nothing.
  test("a file already carrying the values is reported unchanged and is not rewritten", async () => {
    vol.fromJSON({ "/inbox/01.flac": "x" })
    mockCurrentTags({
      "/inbox/01.flac": { albumArtist: "Public Enemy" },
    })

    const records = await firstValueFrom(
      writeAudioTags({
        sourcePath: "/inbox",
        tags: { albumArtist: "Public Enemy" },
      }),
    )

    expect(records[0].kind).toBe("unchanged")
    expect(writeTagsToFile).not.toHaveBeenCalled()
  })

  test("a dry run reports the same changes and writes nothing", async () => {
    vol.fromJSON({ "/inbox/01.flac": "x" })
    mockCurrentTags({})

    const records = await firstValueFrom(
      writeAudioTags({
        isDryRun: true,
        sourcePath: "/inbox",
        tags: { album: "New Album" },
      }),
    )

    expect(records[0]).toMatchObject({
      changedFields: ["album"],
      isDryRun: true,
      kind: "written",
    })
    expect(writeTagsToFile).not.toHaveBeenCalled()
  })

  test("one unwritable file fails alone, and the rest of the batch still writes", async () => {
    vol.fromJSON({
      "/inbox/good.flac": "x",
      "/inbox/locked.flac": "x",
    })
    mockCurrentTags({})
    vi.mocked(writeTagsToFile).mockImplementation(
      ({ filePath }: { filePath: string }) =>
        filePath.endsWith("locked.flac")
          ? Promise.reject(
              new Error("EACCES: permission denied"),
            )
          : Promise.resolve(undefined),
    )

    const records = await firstValueFrom(
      writeAudioTags({
        sourcePath: "/inbox",
        tags: { album: "New Album" },
      }),
    )

    expect(
      records.find(
        (record) => record.filename === "locked.flac",
      ),
    ).toMatchObject({
      kind: "failed",
      reason: "EACCES: permission denied",
    })
    expect(
      records.find(
        (record) => record.filename === "good.flac",
      )?.kind,
    ).toBe("written")
  })

  test("non-audio files in the folder are left alone", async () => {
    vol.fromJSON({
      "/inbox/01.flac": "x",
      "/inbox/cover.jpg": "x",
      "/inbox/movie.mkv": "x",
    })
    mockCurrentTags({})

    const records = await firstValueFrom(
      writeAudioTags({
        sourcePath: "/inbox",
        tags: { album: "New Album" },
      }),
    )

    expect(
      records.map((record) => record.filename),
    ).toEqual(["01.flac"])
  })
})
