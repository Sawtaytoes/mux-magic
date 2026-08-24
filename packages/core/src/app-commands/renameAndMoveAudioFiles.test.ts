import { vol } from "memfs"
import { firstValueFrom } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import type { AudioTags } from "../music/tags/audioTagFields.js"
import { readAudioTags } from "../music/tags/readAudioTags.js"
import {
  hasEnoughMetadataToName,
  renameAndMoveAudioFiles,
} from "./renameAndMoveAudioFiles.js"

vi.mock("../music/tags/readAudioTags.js", () => ({
  readAudioTags: vi.fn(),
}))

const mockTagsByPath = (
  tagsByPath: Record<string, AudioTags>,
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

const publicEnemyTags: AudioTags = {
  album: "It Takes a Nation of Millions",
  albumArtist: "Public Enemy",
  artist: "Public Enemy",
  date: "1988-06-28",
  discNumber: 1,
  title: "Bring the Noise",
  totalDiscs: 1,
  totalTracks: 16,
  trackNumber: 1,
}

describe(hasEnoughMetadataToName.name, () => {
  test("a file with no title cannot be named", () => {
    expect(
      hasEnoughMetadataToName({
        extension: ".flac",
        filePath: "/inbox/01.flac",
        filename: "01.flac",
        info: {
          fileSizeBytes: 0,
          filePath: "/inbox/01.flac",
          hasEmbeddedCoverArt: false,
        },
        kind: "scanned",
        tags: { albumArtist: "Public Enemy" },
      }),
    ).toBe(false)
  })

  test("a file with no artist of any kind cannot be named", () => {
    expect(
      hasEnoughMetadataToName({
        extension: ".flac",
        filePath: "/inbox/01.flac",
        filename: "01.flac",
        info: {
          fileSizeBytes: 0,
          filePath: "/inbox/01.flac",
          hasEmbeddedCoverArt: false,
        },
        kind: "scanned",
        tags: { title: "Bring the Noise" },
      }),
    ).toBe(false)
  })
})

describe(renameAndMoveAudioFiles.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.mocked(readAudioTags).mockReset()
  })

  test("files the tags can name are moved under the library root", async () => {
    vol.fromJSON({ "/inbox/track01.flac": "x" })
    mockTagsByPath({
      "/inbox/track01.flac": publicEnemyTags,
    })

    const records = await firstValueFrom(
      renameAndMoveAudioFiles({
        libraryRoot: "/library",
        sourcePath: "/inbox",
      }),
    )

    expect(records[0].kind).toBe("moved")
    expect(vol.existsSync("/inbox/track01.flac")).toBe(
      false,
    )
    expect(
      Object.keys(vol.toJSON()).some((path) =>
        path.startsWith("/library/Public Enemy/"),
      ),
    ).toBe(true)
  })

  // The acceptance test from docs/picard-parity.md §10: a second pass over
  // an album already filed correctly must move nothing at all.
  test("re-running over an already-filed album produces zero moves", async () => {
    vol.fromJSON({ "/inbox/track01.flac": "x" })
    mockTagsByPath({
      "/inbox/track01.flac": publicEnemyTags,
    })

    const firstPass = await firstValueFrom(
      renameAndMoveAudioFiles({
        libraryRoot: "/library",
        sourcePath: "/inbox",
      }),
    )
    const destination = (
      firstPass[0] as { destination: string }
    ).destination

    mockTagsByPath({ [destination]: publicEnemyTags })

    const secondPass = await firstValueFrom(
      renameAndMoveAudioFiles({
        isRecursive: true,
        libraryRoot: "/library",
        recursiveDepth: 3,
        sourcePath: "/library",
      }),
    )

    expect(
      secondPass.filter(
        (record) => record.kind === "moved",
      ),
    ).toEqual([])
    expect(secondPass[0].kind).toBe("unchanged")
  })

  test("a dry run reports the destination and moves nothing", async () => {
    vol.fromJSON({ "/inbox/track01.flac": "x" })
    mockTagsByPath({
      "/inbox/track01.flac": publicEnemyTags,
    })

    const records = await firstValueFrom(
      renameAndMoveAudioFiles({
        isDryRun: true,
        libraryRoot: "/library",
        sourcePath: "/inbox",
      }),
    )

    expect(records[0]).toMatchObject({
      isDryRun: true,
      kind: "moved",
    })
    expect(vol.existsSync("/inbox/track01.flac")).toBe(true)
  })

  test("an untaggable file is skipped with a reason rather than filed under an empty folder", async () => {
    vol.fromJSON({ "/inbox/unknown.flac": "x" })
    mockTagsByPath({ "/inbox/unknown.flac": {} })

    const records = await firstValueFrom(
      renameAndMoveAudioFiles({
        libraryRoot: "/library",
        sourcePath: "/inbox",
      }),
    )

    expect(records[0].kind).toBe("skipped")
    expect(vol.existsSync("/inbox/unknown.flac")).toBe(true)
  })

  test("a destination that is already taken is skipped, not overwritten", async () => {
    vol.fromJSON({
      "/inbox/a.flac": "new",
      "/inbox/b.flac": "new",
    })
    mockTagsByPath({
      "/inbox/a.flac": publicEnemyTags,
      "/inbox/b.flac": publicEnemyTags,
    })

    const records = await firstValueFrom(
      renameAndMoveAudioFiles({
        libraryRoot: "/library",
        sourcePath: "/inbox",
      }),
    )

    expect(
      records.filter((record) => record.kind === "moved"),
    ).toHaveLength(1)
    expect(
      records.filter((record) => record.kind === "skipped"),
    ).toHaveLength(1)
  })
})
