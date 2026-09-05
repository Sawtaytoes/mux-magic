import { firstValueFrom } from "rxjs"
import { expect, test, vi } from "vitest"

import {
  getItunesArtwork,
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
