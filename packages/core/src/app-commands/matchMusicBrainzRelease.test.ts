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
import { matchMusicBrainzRelease } from "./matchMusicBrainzRelease.js"

vi.mock("../music/tags/readAudioTags.js", () => ({
  readAudioTags: vi.fn(),
}))

// The command is given its fetcher, so the whole MusicBrainz round trip is
// two canned JSON bodies. No network, no rate limiter, no cache — this test
// is about the clustering, the shortlist and the per-file assembly.
const RELEASE_ID = "11111111-2222-3333-4444-555555555555"

const searchBody = JSON.stringify({
  releases: [
    {
      "artist-credit": [
        {
          artist: { id: "artist-1", name: "Public Enemy" },
          joinphrase: "",
          name: "Public Enemy",
        },
      ],
      country: "US",
      date: "1988-06-28",
      id: RELEASE_ID,
      media: [
        { format: "CD", position: 1, "track-count": 2 },
      ],
      score: 100,
      title: "It Takes a Nation of Millions",
      "track-count": 2,
    },
  ],
})

const releaseBody = JSON.stringify({
  "artist-credit": [
    {
      artist: { id: "artist-1", name: "Public Enemy" },
      joinphrase: "",
      name: "Public Enemy",
    },
  ],
  country: "US",
  date: "1988-06-28",
  id: RELEASE_ID,
  media: [
    {
      format: "CD",
      position: 1,
      "track-count": 2,
      tracks: [
        {
          id: "track-1",
          length: 210_000,
          position: 1,
          recording: {
            id: "recording-1",
            length: 210_000,
            title: "Bring the Noise",
          },
          title: "Bring the Noise",
        },
        {
          id: "track-2",
          length: 180_000,
          position: 2,
          recording: {
            id: "recording-2",
            length: 180_000,
            title: "Don't Believe the Hype",
          },
          title: "Don't Believe the Hype",
        },
      ],
    },
  ],
  "release-group": {
    id: "release-group-1",
    "primary-type": "Album",
    "secondary-types": [],
  },
  title: "It Takes a Nation of Millions",
})

const buildCachedFetch = () =>
  vi.fn((url: string) =>
    Promise.resolve({
      body: url.includes("/release?query=")
        ? searchBody
        : releaseBody,
      isFromCache: false,
    }),
  )

const mockTagsByPath = (
  tagsByPath: Record<string, AudioTags>,
) => {
  vi.mocked(readAudioTags).mockImplementation(
    (filePath: string) =>
      Promise.resolve({
        info: {
          durationSeconds: filePath.endsWith("01.flac")
            ? 210
            : 180,
          fileSizeBytes: 1024,
          filePath,
          hasEmbeddedCoverArt: false,
        },
        tags: tagsByPath[filePath] ?? {},
      } as Awaited<ReturnType<typeof readAudioTags>>),
  )
}

describe(matchMusicBrainzRelease.name, () => {
  beforeEach(() => {
    vol.reset()
    vi.mocked(readAudioTags).mockReset()
  })

  test("clusters the folder, ranks a release, and attaches a proposed tag set per file", async () => {
    vol.fromJSON({
      "/inbox/01.flac": "x",
      "/inbox/02.flac": "x",
    })
    mockTagsByPath({
      "/inbox/01.flac": {
        album: "It Takes a Nation of Millions",
        albumArtist: "Public Enemy",
        title: "Bring the Noise",
        trackNumber: 1,
      },
      "/inbox/02.flac": {
        album: "It Takes a Nation of Millions",
        albumArtist: "Public Enemy",
        title: "Don't Believe the Hype",
        trackNumber: 2,
      },
    })

    const clusters = await firstValueFrom(
      matchMusicBrainzRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toMatchObject({
      album: "It Takes a Nation of Millions",
      albumArtist: "Public Enemy",
      isMusicMatch: true,
      trackCount: 2,
    })
    expect(clusters[0].files).toHaveLength(2)
    expect(
      clusters[0].files[0].rankedCandidates[0],
    ).toMatchObject({
      candidate: {
        country: "US",
        releaseId: RELEASE_ID,
        source: "musicbrainz",
        year: "1988",
      },
    })
    expect(
      clusters[0].files[0].rankedCandidates[0].proposedTags,
    ).toMatchObject({
      album: "It Takes a Nation of Millions",
      albumArtist: "Public Enemy",
      title: "Bring the Noise",
      trackNumber: 1,
    })
  })

  test("each file gets its OWN track's proposal, not the first track's", async () => {
    vol.fromJSON({
      "/inbox/01.flac": "x",
      "/inbox/02.flac": "x",
    })
    mockTagsByPath({
      "/inbox/01.flac": {
        album: "It Takes a Nation of Millions",
        albumArtist: "Public Enemy",
        title: "Bring the Noise",
        trackNumber: 1,
      },
      "/inbox/02.flac": {
        album: "It Takes a Nation of Millions",
        albumArtist: "Public Enemy",
        title: "Don't Believe the Hype",
        trackNumber: 2,
      },
    })

    const clusters = await firstValueFrom(
      matchMusicBrainzRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    expect(
      clusters[0].files.map(
        (file) =>
          file.rankedCandidates[0]?.proposedTags.title,
      ),
    ).toEqual(["Bring the Noise", "Don't Believe the Hype"])
  })

  test("the command writes nothing — the files on disk are untouched", async () => {
    vol.fromJSON({ "/inbox/01.flac": "original bytes" })
    mockTagsByPath({
      "/inbox/01.flac": {
        album: "It Takes a Nation of Millions",
        albumArtist: "Public Enemy",
        title: "Bring the Noise",
        trackNumber: 1,
      },
    })

    await firstValueFrom(
      matchMusicBrainzRelease({
        cachedFetch: buildCachedFetch(),
        sourcePath: "/inbox",
      }),
    )

    expect(vol.readFileSync("/inbox/01.flac", "utf8")).toBe(
      "original bytes",
    )
  })

  test("only the shortlist is fetched in full, so the rate limit is not spent on every search hit", async () => {
    vol.fromJSON({ "/inbox/01.flac": "x" })
    mockTagsByPath({
      "/inbox/01.flac": {
        album: "It Takes a Nation of Millions",
        albumArtist: "Public Enemy",
        title: "Bring the Noise",
        trackNumber: 1,
      },
    })
    const cachedFetch = buildCachedFetch()

    await firstValueFrom(
      matchMusicBrainzRelease({
        cachedFetch,
        candidateFetchLimit: 1,
        sourcePath: "/inbox",
      }),
    )

    // One search plus one full release fetch, and nothing more.
    expect(cachedFetch).toHaveBeenCalledTimes(2)
  })

  // Regression, found by running this against the live MusicBrainz service.
  // `tracks:<n>` is a hard Lucene filter: two tracks of a sixteen-track album
  // matched nothing and every row came back with no candidates.
  test("the cluster's track count is not sent as a search filter", async () => {
    vol.fromJSON({ "/inbox/01.flac": "x" })
    mockTagsByPath({
      "/inbox/01.flac": {
        album: "It Takes a Nation of Millions",
        albumArtist: "Public Enemy",
        title: "Bring the Noise",
        trackNumber: 1,
      },
    })
    const cachedFetch = buildCachedFetch()

    await firstValueFrom(
      matchMusicBrainzRelease({
        cachedFetch,
        sourcePath: "/inbox",
      }),
    )

    expect(
      decodeURIComponent(
        cachedFetch.mock.calls[0][0] as string,
      ),
    ).not.toContain("tracks:")
  })

  test("a folder with no audio files is an empty result, not a MusicBrainz request", async () => {
    vol.fromJSON({ "/inbox/readme.txt": "x" })
    const cachedFetch = buildCachedFetch()

    expect(
      await firstValueFrom(
        matchMusicBrainzRelease({
          cachedFetch,
          sourcePath: "/inbox",
        }),
      ),
    ).toEqual([])
    expect(cachedFetch).not.toHaveBeenCalled()
  })
})
