import { firstValueFrom } from "rxjs"
import { expect, test, vi } from "vitest"

import {
  getComparableTrackTitles,
  getIsCandidateConfirmed,
  getItunesArtwork,
  getReleaseYear,
  getSharedTrackTitleCount,
  type ItunesRawResponse,
  normaliseForComparison,
  selectItunesArtwork,
  upgradeArtworkUrl,
} from "./itunesArtwork.js"
import type { CachedFetch } from "./musicBrainzApi.js"

const buildResponse = (
  results: ItunesRawResponse["results"],
): ItunesRawResponse => ({ results })

const buildCachedFetch = (
  rawResponse: ItunesRawResponse,
): CachedFetch =>
  vi.fn(() =>
    Promise.resolve({
      body: JSON.stringify(rawResponse),
      isFromCache: false,
    }),
  )

test("asks for the full-size image rather than the 100 pixel thumbnail", () => {
  expect(
    upgradeArtworkUrl(
      "https://is1-ssl.mzstatic.com/image/thumb/abc/source/100x100bb.jpg",
    ),
  ).toBe(
    "https://is1-ssl.mzstatic.com/image/thumb/abc/source/1200x1200bb.jpg",
  )
})

test("compares titles with punctuation, case and spacing removed", () => {
  expect(normaliseForComparison("Sounds of Neo-SF!")).toBe(
    normaliseForComparison("sounds  of  neo sf"),
  )
})

test("accepts a result whose album and artist both match", () => {
  expect(
    selectItunesArtwork({
      albumTitle: "Modular Heart",
      artistName: "M. Harvey Bee",
      rawResponse: buildResponse([
        {
          artistName: "M Harvey Bee",
          artworkUrl100:
            "https://example.com/a/100x100bb.jpg",
          collectionName: "Modular Heart - EP",
        },
        {
          artistName: "M. Harvey Bee",
          artworkUrl100:
            "https://example.com/b/100x100bb.jpg",
          collectionName: "Modular Heart",
        },
      ]),
    }),
  ).toEqual({
    albumTitle: "Modular Heart",
    artistName: "M. Harvey Bee",
    imageUrl: "https://example.com/b/1200x1200bb.jpg",
  })
})

test("refuses a near-miss title, because wrong art is worse than none", () => {
  expect(
    selectItunesArtwork({
      albumTitle: "Modular Heart",
      artistName: "M. Harvey Bee",
      rawResponse: buildResponse([
        {
          artistName: "M. Harvey Bee",
          artworkUrl100:
            "https://example.com/a/100x100bb.jpg",
          collectionName: "Modular Heart - EP",
        },
      ]),
    }),
  ).toBeNull()
})

test("refuses a matching title by the wrong artist", () => {
  expect(
    selectItunesArtwork({
      albumTitle: "Greatest Hits",
      artistName: "311",
      rawResponse: buildResponse([
        {
          artistName: "Queen",
          artworkUrl100:
            "https://example.com/a/100x100bb.jpg",
          collectionName: "Greatest Hits",
        },
      ]),
    }),
  ).toBeNull()
})

test("refuses a match that carries no artwork", () => {
  expect(
    selectItunesArtwork({
      albumTitle: "Modular Heart",
      artistName: "M. Harvey Bee",
      rawResponse: buildResponse([
        {
          artistName: "M. Harvey Bee",
          collectionName: "Modular Heart",
        },
      ]),
    }),
  ).toBeNull()
})

test("searches on the artist and album together", async () => {
  const cachedFetch = buildCachedFetch(buildResponse([]))

  await firstValueFrom(
    getItunesArtwork({
      albumTitle: "Modular Heart",
      artistName: "M. Harvey Bee",
      cachedFetch,
    }),
  )

  expect(cachedFetch).toHaveBeenCalledWith(
    expect.stringContaining(
      "term=M.+Harvey+Bee+Modular+Heart",
    ),
  )
})

test("does not search when there is no album or artist to search on", async () => {
  const cachedFetch = buildCachedFetch(buildResponse([]))

  expect(
    await firstValueFrom(
      getItunesArtwork({
        albumTitle: "",
        artistName: "M. Harvey Bee",
        cachedFetch,
      }),
    ),
  ).toBeNull()

  expect(cachedFetch).not.toHaveBeenCalled()
})

test("an unreachable provider reports no art rather than stopping the chain", async () => {
  expect(
    await firstValueFrom(
      getItunesArtwork({
        albumTitle: "Modular Heart",
        artistName: "M. Harvey Bee",
        cachedFetch: vi.fn(() =>
          Promise.reject(new Error("network is down")),
        ),
      }),
    ),
  ).toBeNull()
})

// A URL-keyed fetch, because confirming a candidate is a SECOND request: the
// search finds it, the lookup reads its track list.
const buildRoutedFetch = (
  responsesByUrlFragment: Record<string, ItunesRawResponse>,
): CachedFetch =>
  vi.fn((url: string) =>
    ((entry) =>
      entry === undefined
        ? Promise.reject(new Error(`no stub for ${url}`))
        : Promise.resolve({
            body: JSON.stringify(entry[1]),
            isFromCache: false,
          }))(
      Object.entries(responsesByUrlFragment).find(
        ([fragment]) => url.includes(fragment),
      ),
    ),
  )

test("treats a track title and the same title with a trailing qualifier as comparable", () => {
  expect([
    ...getComparableTrackTitles("Fame (radio edit)"),
  ]).toContain(normaliseForComparison("Fame"))
})

test("counts a shared track title across a difference in the bracketed qualifier", () => {
  expect(
    getSharedTrackTitleCount({
      candidateTrackTitles: ["Fame (Theme)", "Party Party"],
      localTrackTitles: ["Fame (radio edit)"],
    }),
  ).toBe(1)
})

test("counts no shared title when the two track lists are unrelated", () => {
  expect(
    getSharedTrackTitleCount({
      candidateTrackTitles: ["Spheres", "Nebula", "Naan"],
      localTrackTitles: ["What Is Love"],
    }),
  ).toBe(0)
})

test("reads the year out of a full release date", () => {
  expect(getReleaseYear("2024-11-04")).toBe(2024)
  expect(getReleaseYear("2001")).toBe(2001)
  expect(getReleaseYear(undefined)).toBeNull()
})

test("confirms a candidate that shares a track title even when the years disagree", () => {
  // The Foundations' "Build Me Up Buttercup": the file is dated 2007 because
  // that is when it was ripped, and Apple dates the release 1968.
  expect(
    getIsCandidateConfirmed({
      candidateTrackTitles: ["Build Me Up Buttercup"],
      candidateYear: 1968,
      localTrackTitles: ["Build Me Up Buttercup"],
      releaseYear: 2007,
    }),
  ).toBe(true)
})

test("confirms a candidate on the year when the titles are the same track in two scripts", () => {
  // Hitomi Mieno's "Baby Leaf": the file's title is Japanese and Apple's is
  // the romanisation, so the two share nothing to compare.
  expect(
    getIsCandidateConfirmed({
      candidateTrackTitles: ["Yukkuri", "Mitsuami"],
      candidateYear: 2001,
      localTrackTitles: ["ゆっくり"],
      releaseYear: 2001,
    }),
  ).toBe(true)
})

test("refuses a candidate that shares no track title and comes from a different era", () => {
  // The album this whole check exists for: a 2001 compilation called Pulse
  // credited to Various Artists, and a 2024 album called Pulse credited to
  // Various Artists. Title and artist match exactly; nothing else does.
  expect(
    getIsCandidateConfirmed({
      candidateTrackTitles: ["Spheres", "Nebula", "Naan"],
      candidateYear: 2024,
      localTrackTitles: ["What Is Love"],
      releaseYear: 2001,
    }),
  ).toBe(false)
})

test("refuses a candidate when there is no year to fall back on and no shared title", () => {
  expect(
    getIsCandidateConfirmed({
      candidateTrackTitles: ["Spheres"],
      candidateYear: null,
      localTrackTitles: ["What Is Love"],
      releaseYear: null,
    }),
  ).toBe(false)
})

test("reads the candidate's track list before it accepts the artwork", async () => {
  const cachedFetch = buildRoutedFetch({
    "/search": buildResponse([
      {
        artistName: "Various Artists",
        artworkUrl100:
          "https://example.com/a/100x100bb.jpg",
        collectionId: 1,
        collectionName: "Pulse",
        releaseDate: "2001-01-01",
      },
    ]),
    "/lookup": buildResponse([
      { wrapperType: "collection" },
      { trackName: "What Is Love", wrapperType: "track" },
    ]),
  })

  expect(
    await firstValueFrom(
      getItunesArtwork({
        albumTitle: "Pulse",
        artistName: "Various Artists",
        cachedFetch,
        localTrackTitles: ["What Is Love"],
        releaseYear: 2001,
      }),
    ),
  ).toEqual({
    albumTitle: "Pulse",
    artistName: "Various Artists",
    imageUrl: "https://example.com/a/1200x1200bb.jpg",
  })
})

test("returns nothing when the name matches but the track list does not", async () => {
  const cachedFetch = buildRoutedFetch({
    "/search": buildResponse([
      {
        artistName: "Various Artists",
        artworkUrl100:
          "https://example.com/a/100x100bb.jpg",
        collectionId: 1,
        collectionName: "Pulse",
        releaseDate: "2024-11-04",
      },
    ]),
    "/lookup": buildResponse([
      { trackName: "Spheres", wrapperType: "track" },
      { trackName: "Nebula", wrapperType: "track" },
    ]),
  })

  expect(
    await firstValueFrom(
      getItunesArtwork({
        albumTitle: "Pulse",
        artistName: "Various Artists",
        cachedFetch,
        localTrackTitles: ["What Is Love"],
        releaseYear: 2001,
      }),
    ),
  ).toBeNull()
})

test("takes the second candidate when the first one cannot be confirmed", async () => {
  const cachedFetch = vi.fn((url: string) =>
    Promise.resolve({
      body: JSON.stringify(
        url.includes("/lookup")
          ? buildResponse(
              url.includes("id=1")
                ? [
                    {
                      trackName: "Spheres",
                      wrapperType: "track",
                    },
                  ]
                : [
                    {
                      trackName: "What Is Love",
                      wrapperType: "track",
                    },
                  ],
            )
          : buildResponse([
              {
                artistName: "Various Artists",
                artworkUrl100:
                  "https://example.com/wrong/100x100bb.jpg",
                collectionId: 1,
                collectionName: "Pulse",
                releaseDate: "2024-11-04",
              },
              {
                artistName: "Various Artists",
                artworkUrl100:
                  "https://example.com/right/100x100bb.jpg",
                collectionId: 2,
                collectionName: "Pulse",
                releaseDate: "2001-01-01",
              },
            ]),
      ),
      isFromCache: false,
    }),
  )

  expect(
    await firstValueFrom(
      getItunesArtwork({
        albumTitle: "Pulse",
        artistName: "Various Artists",
        cachedFetch,
        localTrackTitles: ["What Is Love"],
        releaseYear: 2001,
      }),
    ),
  ).toEqual({
    albumTitle: "Pulse",
    artistName: "Various Artists",
    imageUrl: "https://example.com/right/1200x1200bb.jpg",
  })
})

test("keeps the first name match when the caller has nothing to confirm against", async () => {
  const cachedFetch = buildCachedFetch(
    buildResponse([
      {
        artistName: "Various Artists",
        artworkUrl100:
          "https://example.com/a/100x100bb.jpg",
        collectionId: 1,
        collectionName: "Pulse",
      },
    ]),
  )

  expect(
    await firstValueFrom(
      getItunesArtwork({
        albumTitle: "Pulse",
        artistName: "Various Artists",
        cachedFetch,
      }),
    ),
  ).toEqual({
    albumTitle: "Pulse",
    artistName: "Various Artists",
    imageUrl: "https://example.com/a/1200x1200bb.jpg",
  })
  expect(cachedFetch).toHaveBeenCalledTimes(1)
})
