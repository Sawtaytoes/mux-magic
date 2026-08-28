import { of, throwError } from "rxjs"
import { describe, expect, test, vi } from "vitest"
import { matchDiscogsRelease } from "./matchDiscogsRelease.js"
import { matchFreedbRelease } from "./matchFreedbRelease.js"
import {
  type MusicMatchClusterRecord,
  matchMusicBrainzRelease,
} from "./matchMusicBrainzRelease.js"
import {
  matchMusicRelease,
  mergeMusicMatchClusters,
} from "./matchMusicRelease.js"
import { matchVgmdbRelease } from "./matchVgmdbRelease.js"

vi.mock("./matchFreedbRelease.js", () => ({
  matchFreedbRelease: vi.fn(),
}))

vi.mock("./matchDiscogsRelease.js", () => ({
  matchDiscogsRelease: vi.fn(),
}))

vi.mock("./matchMusicBrainzRelease.js", () => ({
  matchMusicBrainzRelease: vi.fn(),
}))

vi.mock("./matchVgmdbRelease.js", () => ({
  matchVgmdbRelease: vi.fn(),
}))

const buildCluster = ({
  confidence,
  releaseId,
  source,
}: {
  confidence: number
  releaseId: string
  source: "discogs" | "freedb" | "musicbrainz" | "vgmdb"
}): MusicMatchClusterRecord => ({
  album: "An Album",
  albumArtist: "An Artist",
  files: [
    {
      currentTags: { title: "Track One" },
      durationSeconds: 180,
      extension: ".flac",
      filePath: "/inbox/01.flac",
      filename: "01.flac",
      rankedCandidates: [
        {
          candidate: {
            artistName: "An Artist",
            releaseId,
            releaseTitle: "An Album",
            source,
          },
          confidence,
          proposedTags: { title: "Track One" },
        },
      ],
    },
  ],
  isMusicMatch: true,
  kind: "cluster",
  trackCount: 1,
})

describe(mergeMusicMatchClusters.name, () => {
  test("combines every provider into one ranked file row", () => {
    const merged = mergeMusicMatchClusters([
      [
        buildCluster({
          confidence: 0.8,
          releaseId: "discogs",
          source: "discogs",
        }),
      ],
      [
        buildCluster({
          confidence: 0.8,
          releaseId: "mb",
          source: "musicbrainz",
        }),
      ],
      [
        buildCluster({
          confidence: 0.9,
          releaseId: "vgm",
          source: "vgmdb",
        }),
      ],
      [
        buildCluster({
          confidence: 0.7,
          releaseId: "free",
          source: "freedb",
        }),
      ],
    ])

    expect(
      merged[0].files[0].rankedCandidates.map(
        (scored) => scored.candidate.source,
      ),
    ).toEqual(["vgmdb", "musicbrainz", "discogs", "freedb"])
  })

  test("uses provider order to break equal-confidence ties", () => {
    const merged = mergeMusicMatchClusters([
      [
        buildCluster({
          confidence: 0.8,
          releaseId: "mb",
          source: "musicbrainz",
        }),
      ],
      [
        buildCluster({
          confidence: 0.8,
          releaseId: "vgm",
          source: "vgmdb",
        }),
      ],
    ])

    expect(
      merged[0].files[0].rankedCandidates.map(
        (scored) => scored.candidate.source,
      ),
    ).toEqual(["musicbrainz", "vgmdb"])
  })
})

describe(matchMusicRelease.name, () => {
  test("runs all four providers and combines their results", async () => {
    vi.mocked(matchMusicBrainzRelease).mockReturnValue(
      of([
        buildCluster({
          confidence: 0.8,
          releaseId: "mb",
          source: "musicbrainz",
        }),
      ]),
    )
    vi.mocked(matchVgmdbRelease).mockReturnValue(
      of([
        buildCluster({
          confidence: 0.9,
          releaseId: "vgm",
          source: "vgmdb",
        }),
      ]),
    )
    vi.mocked(matchDiscogsRelease).mockReturnValue(
      of([
        buildCluster({
          confidence: 0.75,
          releaseId: "discogs",
          source: "discogs",
        }),
      ]),
    )
    vi.mocked(matchFreedbRelease).mockReturnValue(
      of([
        buildCluster({
          confidence: 0.7,
          releaseId: "free",
          source: "freedb",
        }),
      ]),
    )

    const results = await new Promise<
      MusicMatchClusterRecord[]
    >((resolve, reject) => {
      matchMusicRelease({ sourcePath: "/inbox" }).subscribe(
        {
          error: reject,
          next: resolve,
        },
      )
    })

    expect(matchMusicBrainzRelease).toHaveBeenCalledOnce()
    expect(matchVgmdbRelease).toHaveBeenCalledOnce()
    expect(matchDiscogsRelease).toHaveBeenCalledOnce()
    expect(matchFreedbRelease).toHaveBeenCalledOnce()
    expect(
      results[0].files[0].rankedCandidates,
    ).toHaveLength(4)
  })

  test("continues when one provider fails", async () => {
    vi.mocked(matchMusicBrainzRelease).mockReturnValue(
      throwError(() => new Error("offline")),
    )
    vi.mocked(matchVgmdbRelease).mockReturnValue(
      of([
        buildCluster({
          confidence: 0.9,
          releaseId: "vgm",
          source: "vgmdb",
        }),
      ]),
    )
    vi.mocked(matchDiscogsRelease).mockReturnValue(of([]))
    vi.mocked(matchFreedbRelease).mockReturnValue(of([]))

    const results = await new Promise<
      MusicMatchClusterRecord[]
    >((resolve, reject) => {
      matchMusicRelease({ sourcePath: "/inbox" }).subscribe(
        {
          error: reject,
          next: resolve,
        },
      )
    })

    expect(
      results[0].files[0].rankedCandidates[0].candidate
        .source,
    ).toBe("vgmdb")
  })
})
