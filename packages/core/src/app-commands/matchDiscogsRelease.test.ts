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
import { matchDiscogsRelease } from "./matchDiscogsRelease.js"

vi.mock("../music/tags/readAudioTags.js", () => ({
  readAudioTags: vi.fn(),
}))

const SEARCH_RESPONSE = JSON.stringify({
  results: [
    {
      artists: [{ id: 1, name: "Nintendo (2)" }],
      id: 10,
      title: "The Legend of Zelda",
    },
  ],
})

const RELEASE_RESPONSE = JSON.stringify({
  artists: [{ id: 1, name: "Nintendo (2)" }],
  country: "Japan",
  genres: ["Stage & Screen"],
  id: 10,
  released: "1986-02-21",
  title: "The Legend of Zelda",
  tracklist: [
    {
      duration: "3:30",
      position: "1",
      title: "Overworld",
      type_: "track",
    },
    {
      duration: "3:05",
      position: "2",
      title: "Dungeon",
      type_: "track",
    },
  ],
})

const createCachedFetch = () =>
  vi.fn((url: string) =>
    Promise.resolve({
      body: url.includes("database/search")
        ? SEARCH_RESPONSE
        : RELEASE_RESPONSE,
      isFromCache: false,
    }),
  )

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

describe(matchDiscogsRelease.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.mocked(readAudioTags).mockReset()
  })

  test("offers Discogs metadata without MusicBrainz ids", async () => {
    mockTwoTracks()

    const clusters = await firstValueFrom(
      matchDiscogsRelease({
        cachedFetch: createCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    expect(
      clusters[0].files[0].rankedCandidates[0].candidate,
    ).toMatchObject({
      releaseId: "10",
      source: "discogs",
    })
    expect(
      clusters[0].files[0].rankedCandidates[0].proposedTags,
    ).toMatchObject({
      album: "The Legend of Zelda",
      albumArtist: "Nintendo",
      date: "1986",
      title: "Overworld",
      trackNumber: 1,
    })
    expect(
      clusters[0].files[0].rankedCandidates[0].proposedTags,
    ).not.toHaveProperty("musicBrainzReleaseId")
  })
})
