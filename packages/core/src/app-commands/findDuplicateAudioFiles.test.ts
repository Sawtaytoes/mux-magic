import { vol } from "memfs"
import { firstValueFrom } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { getAudioContentHash } from "../music/duplicates/audioContentHash.js"
import type { AudioTags } from "../music/tags/audioTagFields.js"
import { readAudioTags } from "../music/tags/readAudioTags.js"
import { findDuplicateAudioFiles } from "./findDuplicateAudioFiles.js"

vi.mock("../music/tags/readAudioTags.js", () => ({
  readAudioTags: vi.fn(),
}))

vi.mock("../music/duplicates/audioContentHash.js", () => ({
  getAudioContentHash: vi.fn(),
}))

const mockFiles = (
  filesByPath: Record<
    string,
    {
      bitDepth?: number
      hash: string | null
      tags?: AudioTags
    }
  >,
) => {
  vol.fromJSON(
    Object.fromEntries(
      Object.keys(filesByPath).map((filePath) => [
        filePath,
        "x",
      ]),
    ),
  )
  vi.mocked(getAudioContentHash).mockImplementation(
    (filePath: string) =>
      Promise.resolve(filesByPath[filePath]?.hash ?? null),
  )
  vi.mocked(readAudioTags).mockImplementation(
    (filePath: string) =>
      Promise.resolve({
        info: {
          bitDepth: filesByPath[filePath]?.bitDepth,
          fileSizeBytes: 1024,
          filePath,
          hasEmbeddedCoverArt: false,
        },
        tags: filesByPath[filePath]?.tags ?? {},
      } as Awaited<ReturnType<typeof readAudioTags>>),
  )
}

describe(findDuplicateAudioFiles.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.mocked(readAudioTags).mockReset()
    vi.mocked(getAudioContentHash).mockReset()
  })

  test("groups identical audio and recommends the lossless copy", async () => {
    mockFiles({
      "/library/track.flac": {
        bitDepth: 16,
        hash: "same-audio",
      },
      "/library/track.mp3": { hash: "same-audio" },
    })

    const groups = await firstValueFrom(
      findDuplicateAudioFiles({
        sourcePath: "/library",
      }),
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].matchReason).toBe("audio")
    expect(
      groups[0].copies.find(
        (copy) => copy.isRecommendedKeep,
      )?.filePath,
    ).toBe("/library/track.flac")
  })

  // The point of the whole safety posture: a ` (N)` file is routinely a
  // different edition, not a copy, and the library has real examples.
  // Different audio means no group, so nothing is ever offered for
  // removal.
  test("a ` (N)` file with different audio is NOT a duplicate", async () => {
    mockFiles({
      "/library/Track (1).flac": { hash: "different" },
      "/library/Track.flac": { hash: "original" },
    })

    expect(
      await firstValueFrom(
        findDuplicateAudioFiles({
          sourcePath: "/library",
        }),
      ),
    ).toEqual([])
  })

  test("a ` (N)` file with identical audio is a duplicate, and the base is kept", async () => {
    mockFiles({
      "/library/Track (1).flac": { hash: "same" },
      "/library/Track.flac": { hash: "same" },
    })

    const groups = await firstValueFrom(
      findDuplicateAudioFiles({
        sourcePath: "/library",
      }),
    )

    expect(
      groups[0].copies.find(
        (copy) => copy.isRecommendedKeep,
      )?.filePath,
    ).toBe("/library/Track.flac")
  })

  test("falls back to tags when the audio hashes differ", async () => {
    mockFiles({
      "/inbox/01.flac": {
        hash: "a",
        tags: {
          album: "Happy Nation",
          albumArtist: "Ace of Base",
          title: "All That She Wants",
          trackNumber: 1,
        },
      },
      "/inbox/copy.mp3": {
        hash: "b",
        tags: {
          album: "Happy Nation",
          albumArtist: "Ace of Base",
          title: "All That She Wants",
          trackNumber: 1,
        },
      },
    })

    const groups = await firstValueFrom(
      findDuplicateAudioFiles({
        sourcePath: "/inbox",
      }),
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].matchReason).toBe("tags")
  })

  test("reports nothing when every file is distinct", async () => {
    mockFiles({
      "/library/a.flac": {
        hash: "a",
        tags: { album: "X", title: "A", trackNumber: 1 },
      },
      "/library/b.flac": {
        hash: "b",
        tags: { album: "X", title: "B", trackNumber: 2 },
      },
    })

    expect(
      await firstValueFrom(
        findDuplicateAudioFiles({
          sourcePath: "/library",
        }),
      ),
    ).toEqual([])
  })

  // A file that will not decode still belongs in the tag-matched groups.
  test("a file that cannot be hashed still groups by tags", async () => {
    mockFiles({
      "/inbox/broken.flac": {
        hash: null,
        tags: {
          album: "Happy Nation",
          albumArtist: "Ace of Base",
          title: "All That She Wants",
          trackNumber: 1,
        },
      },
      "/library/good.flac": {
        hash: null,
        tags: {
          album: "Happy Nation",
          albumArtist: "Ace of Base",
          title: "All That She Wants",
          trackNumber: 1,
        },
      },
    })

    const groups = await firstValueFrom(
      findDuplicateAudioFiles({
        sourcePath: "/",
        recursiveDepth: 2,
      }),
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].matchReason).toBe("tags")
  })
})
