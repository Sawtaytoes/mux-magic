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
import { matchFreedbRelease } from "./matchFreedbRelease.js"

vi.mock("../music/tags/readAudioTags.js", () => ({
  readAudioTags: vi.fn(),
}))

const FREEDB_QUERY =
  "200 misc 610a9b08 Nintendo / The Legend of Zelda"

const FREEDB_READ = [
  "210 misc 610a9b08",
  "# xmcd",
  "DTITLE=Nintendo / The Legend of Zelda",
  "DYEAR=1986",
  "DGENRE=Game",
  "TTITLE0=Overworld",
  "TTITLE1=Dungeon",
  ".",
].join("\n")

const mockTwoTracks = () => {
  vol.fromJSON({
    "/inbox/01.flac": "x",
    "/inbox/02.flac": "x",
  })
  vi.mocked(readAudioTags).mockImplementation(
    (filePath: string) =>
      Promise.resolve({
        info: {
          durationSeconds: filePath.endsWith("01.flac")
            ? 210
            : 185,
          fileSizeBytes: 1024,
          filePath,
          hasEmbeddedCoverArt: false,
        },
        tags: {
          album: "The Legend of Zelda",
          albumArtist: "Nintendo",
          trackNumber: filePath.endsWith("01.flac") ? 1 : 2,
        },
      } as Awaited<ReturnType<typeof readAudioTags>>),
  )
}

const buildCachedFetch = () =>
  vi.fn((url: string) =>
    Promise.resolve({
      body: url.includes("cddb+query")
        ? FREEDB_QUERY
        : FREEDB_READ,
      isFromCache: false,
    }),
  )

describe(matchFreedbRelease.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.mocked(readAudioTags).mockReset()
  })

  test("labels its candidates as freedb, not vgmdb", async () => {
    mockTwoTracks()

    const clusters = await firstValueFrom(
      matchFreedbRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    expect(
      clusters[0].files[0].rankedCandidates[0].candidate
        .source,
    ).toBe("freedb")
  })

  test("asks the freedb server, not VGMdb", async () => {
    mockTwoTracks()
    const cachedFetch = buildCachedFetch()

    await firstValueFrom(
      matchFreedbRelease({
        cachedFetch,
        sourcePath: "/inbox",
      }),
    )

    expect(cachedFetch.mock.calls[0]?.[0]).toContain(
      "freedb.dbpoweramp.com",
    )
    expect(cachedFetch.mock.calls[0]?.[0]).not.toContain(
      "vgmdb.net",
    )
  })

  // freedb carries no id of its own, so the disc id is the only stable
  // handle. An empty one would make every candidate look identical to
  // the table's sort.
  test("falls back to category and disc id for the release id", async () => {
    mockTwoTracks()

    const clusters = await firstValueFrom(
      matchFreedbRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    expect(
      clusters[0].files[0].rankedCandidates[0].candidate
        .releaseId,
    ).toBe("misc:610a9b08")
  })

  test("reads freedb's populated artist into the proposal", async () => {
    mockTwoTracks()

    const clusters = await firstValueFrom(
      matchFreedbRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    expect(
      clusters[0].files[0].rankedCandidates[0].proposedTags,
    ).toMatchObject({
      album: "The Legend of Zelda",
      albumArtist: "Nintendo",
      title: "Overworld",
      trackNumber: 1,
    })
  })
})
