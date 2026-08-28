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
import { matchVgmdbRelease } from "./matchVgmdbRelease.js"

vi.mock("../music/tags/readAudioTags.js", () => ({
  readAudioTags: vi.fn(),
}))

const QUERY_EXACT =
  "200 Soundtrack32937 abcdef02 [CAT-001] A Game Soundtrack"

const QUERY_INEXACT = [
  "211 Found inexact matches list follows (until terminating marker `.')",
  "Soundtrack32937 abcdef02 [CAT-001] A Game Soundtrack",
  "Soundtrack46513 abcdef02 A Game Soundtrack",
  ".",
].join("\n")

const buildReadBody = ({
  albumTitle = "[CAT-001] A Game Soundtrack",
  titles = ["Opening Theme", "Battle Theme"],
}: {
  albumTitle?: string
  titles?: string[]
} = {}) =>
  [
    "210 Soundtrack32937 abcdef02",
    "# xmcd",
    `DTITLE= / ${albumTitle}`,
    "DYEAR=2011",
    "DGENRE=Game",
    "EXTD=https://vgmdb.net/album/57899",
    ...titles.map(
      (title, index) => `TTITLE${index}=${title}`,
    ),
    ".",
  ].join("\n")

const buildCachedFetch = ({
  queryBody = QUERY_EXACT,
  readBody = buildReadBody(),
}: {
  queryBody?: string
  readBody?: string
} = {}) =>
  vi.fn((url: string) =>
    Promise.resolve({
      body: url.includes("cddb+query")
        ? queryBody
        : readBody,
      isFromCache: false,
    }),
  )

const mockFiles = (
  filesByPath: Record<
    string,
    { durationSeconds: number; tags: AudioTags }
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
  vi.mocked(readAudioTags).mockImplementation(
    (filePath: string) =>
      Promise.resolve({
        info: {
          durationSeconds:
            filesByPath[filePath]?.durationSeconds,
          fileSizeBytes: 1024,
          filePath,
          hasEmbeddedCoverArt: false,
        },
        tags: filesByPath[filePath]?.tags ?? {},
      } as Awaited<ReturnType<typeof readAudioTags>>),
  )
}

const TWO_TRACK_ALBUM = {
  "/inbox/01.flac": {
    durationSeconds: 210,
    tags: {
      album: "A Game Soundtrack",
      albumArtist: "Some Composer",
      title: "Opening Theme",
      trackNumber: 1,
    },
  },
  "/inbox/02.flac": {
    durationSeconds: 185,
    tags: {
      album: "A Game Soundtrack",
      albumArtist: "Some Composer",
      title: "Battle Theme",
      trackNumber: 2,
    },
  },
}

describe(matchVgmdbRelease.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.mocked(readAudioTags).mockReset()
  })

  test("attaches a VGMdb candidate with the album's own titles", async () => {
    mockFiles(TWO_TRACK_ALBUM)

    const clusters = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    expect(clusters).toHaveLength(1)
    expect(
      clusters[0].files[0].rankedCandidates[0],
    ).toMatchObject({
      candidate: {
        releaseId: "57899",
        releaseTitle: "[CAT-001] A Game Soundtrack",
        source: "vgmdb",
        year: "2011",
      },
    })
  })

  // A VGMdb track carries no track number. Its POSITION is its number, so
  // each row must get its own position's title — not the first one.
  test("each file gets its own position's title", async () => {
    mockFiles(TWO_TRACK_ALBUM)

    const clusters = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    expect(
      clusters[0].files[0].rankedCandidates[0].proposedTags,
    ).toMatchObject({
      title: "Opening Theme",
      trackNumber: 1,
    })
    expect(
      clusters[0].files[1].rankedCandidates[0].proposedTags,
    ).toMatchObject({
      title: "Battle Theme",
      trackNumber: 2,
    })
  })

  test("emits the same shape the tag review table already renders", async () => {
    mockFiles(TWO_TRACK_ALBUM)

    const clusters = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    expect(clusters[0]).toMatchObject({
      isMusicMatch: true,
      kind: "cluster",
    })
  })

  // VGMdb's CDDB view has no per-track artist and no recording id.
  // Filling those with a guess would overwrite good data, and an absent
  // field means "leave what is there" all the way down to the writer.
  test("leaves out the fields VGMdb cannot know", async () => {
    mockFiles(TWO_TRACK_ALBUM)

    const clusters = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    const proposed =
      clusters[0].files[0].rankedCandidates[0].proposedTags
    expect(proposed.artist).toBeUndefined()
    expect(proposed.musicBrainzRecordingId).toBeUndefined()
  })

  test("an exact match scores higher than an inexact one", async () => {
    mockFiles(TWO_TRACK_ALBUM)

    const exact = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )
    vol.reset()
    mockFiles(TWO_TRACK_ALBUM)
    const inexact = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch({
          queryBody: QUERY_INEXACT,
        }),
        sourcePath: "/inbox",
      }),
    )

    expect(
      exact[0].files[0].rankedCandidates[0].confidence,
    ).toBeGreaterThan(
      inexact[0].files[0].rankedCandidates[0].confidence,
    )
  })

  test("Japanese tags produce a finite confidence", async () => {
    mockFiles({
      "/inbox/01.flac": {
        durationSeconds: 210,
        tags: {
          album: "森羅万象",
          albumArtist: "大塚彩子",
          title: "また夏が来る",
          trackNumber: 1,
        },
      },
      "/inbox/02.flac": {
        durationSeconds: 185,
        tags: {
          album: "森羅万象",
          albumArtist: "大塚彩子",
          title: "forget-me-not",
          trackNumber: 2,
        },
      },
    })

    const clusters = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch({
          readBody: buildReadBody({
            titles: ["また夏が来る", "forget-me-not"],
          }),
        }),
        sourcePath: "/inbox",
      }),
    )

    const confidence =
      clusters[0].files[0].rankedCandidates[0].confidence
    expect(confidence).toBeTypeOf("number")
    expect(Number.isFinite(confidence)).toBe(true)
  })

  // An album VGMdb has never seen is a normal outcome. The row set still
  // arrives, with nothing offered on it.
  test("no match leaves the rows with no candidates", async () => {
    mockFiles(TWO_TRACK_ALBUM)

    const clusters = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch({
          queryBody: "202 No match found",
        }),
        sourcePath: "/inbox",
      }),
    )

    expect(clusters[0].files[0].rankedCandidates).toEqual(
      [],
    )
  })

  // One wrong offset changes the disc id, and a query built from a
  // missing duration can only mismatch. Refusing beats guessing.
  test("a file with no readable duration stops the query", async () => {
    mockFiles({
      ...TWO_TRACK_ALBUM,
      "/inbox/03.flac": {
        durationSeconds: undefined as unknown as number,
        tags: {
          album: "A Game Soundtrack",
          albumArtist: "Some Composer",
          title: "Ending Theme",
          trackNumber: 3,
        },
      },
    })
    const cachedFetch = buildCachedFetch()

    const clusters = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch,
        sourcePath: "/inbox",
      }),
    )

    expect(cachedFetch).not.toHaveBeenCalled()
    expect(clusters[0].files[0].rankedCandidates).toEqual(
      [],
    )
  })

  // A release with fewer tracks than the folder cannot name the extra
  // file, so it is not offered on that row.
  test("a shorter release is not offered for a row it cannot name", async () => {
    mockFiles(TWO_TRACK_ALBUM)

    const clusters = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch({
          readBody: buildReadBody({
            titles: ["Opening Theme"],
          }),
        }),
        sourcePath: "/inbox",
      }),
    )

    expect(
      clusters[0].files[0].rankedCandidates,
    ).toHaveLength(1)
    expect(
      clusters[0].files[1].rankedCandidates,
    ).toHaveLength(0)
  })

  test("asks VGMdb for the language the caller chose", async () => {
    mockFiles(TWO_TRACK_ALBUM)
    const cachedFetch = buildCachedFetch()

    await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch,
        language: "ja-Latn",
        sourcePath: "/inbox",
      }),
    )

    expect(cachedFetch.mock.calls[0]?.[0]).toContain(
      "/cddb/ja-Latn/cddb.cgi",
    )
  })

  test("a selected VGMdb album id filters the disc matches by canonical EXTD id", async () => {
    mockFiles(TWO_TRACK_ALBUM)

    const matching = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
        vgmdbAlbumId: "57899",
      }),
    )
    vol.reset()
    mockFiles(TWO_TRACK_ALBUM)
    const rejected = await firstValueFrom(
      matchVgmdbRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
        vgmdbAlbumId: "99999",
      }),
    )

    expect(
      matching[0].files[0].rankedCandidates,
    ).toHaveLength(1)
    expect(
      rejected[0].files[0].rankedCandidates,
    ).toHaveLength(0)
  })
})
