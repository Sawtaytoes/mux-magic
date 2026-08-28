import { firstValueFrom } from "rxjs"
import { describe, expect, test, vi } from "vitest"

import {
  type DiscogsRawRelease,
  getDiscogsRelease,
  mapDiscogsRelease,
  searchDiscogsReleases,
} from "./discogsApi.js"

const SEARCH_RESPONSE = JSON.stringify({
  results: [
    {
      artists: [{ id: 1, name: "Nintendo (2)" }],
      formats: [{ descriptions: ["Album"], name: "CD" }],
      id: 10,
      title: "The Legend of Zelda",
    },
  ],
})

const RELEASE_RESPONSE = JSON.stringify({
  artists: [{ id: 1, name: "Nintendo (2)" }],
  country: "Japan",
  formats: [{ descriptions: ["Album"], name: "CD" }],
  genres: ["Stage & Screen"],
  id: 10,
  labels: [{ name: "Nintendo" }],
  released: "1986-02-21",
  styles: ["Video Game Music"],
  title: "The Legend of Zelda",
  tracklist: [
    { position: "1-1", title: "Overworld", type_: "track" },
    { position: "1-2", title: "Dungeon", type_: "track" },
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

describe(mapDiscogsRelease.name, () => {
  test("removes Discogs artist disambiguators from tag text", () => {
    expect(
      mapDiscogsRelease(
        JSON.parse(RELEASE_RESPONSE) as DiscogsRawRelease,
      ).artistCredit,
    ).toEqual([
      { artistId: "1", joinPhrase: "", name: "Nintendo" },
    ])
  })

  test("keeps disc and track positions from a multi-disc tracklist", () => {
    expect(
      mapDiscogsRelease(
        JSON.parse(RELEASE_RESPONSE) as DiscogsRawRelease,
      ).tracks,
    ).toEqual([
      {
        artistCredit: [],
        discNumber: 1,
        lengthMilliseconds: null,
        position: 1,
        title: "Overworld",
      },
      {
        artistCredit: [],
        discNumber: 1,
        lengthMilliseconds: null,
        position: 2,
        title: "Dungeon",
      },
    ])
  })
})

describe(searchDiscogsReleases.name, () => {
  test("searches by artist and album and keeps only releases", async () => {
    const cachedFetch = createCachedFetch()

    const releases = await firstValueFrom(
      searchDiscogsReleases({
        albumName: "The Legend of Zelda",
        artistName: "Nintendo",
        cachedFetch,
      }),
    )

    expect(cachedFetch.mock.calls[0]?.[0]).toContain(
      "artist=Nintendo",
    )
    expect(cachedFetch.mock.calls[0]?.[0]).toContain(
      "release_title=The+Legend+of+Zelda",
    )
    expect(releases[0]?.releaseId).toBe("10")
  })
})

describe(getDiscogsRelease.name, () => {
  test("reads a full release by its Discogs release id", async () => {
    const cachedFetch = createCachedFetch()

    const release = await firstValueFrom(
      getDiscogsRelease({ cachedFetch, releaseId: "10" }),
    )

    expect(cachedFetch.mock.calls[0]?.[0]).toBe(
      "https://api.discogs.com/releases/10",
    )
    expect(release.trackCount).toBe(2)
  })
})
