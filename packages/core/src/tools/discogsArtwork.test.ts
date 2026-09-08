import { firstValueFrom } from "rxjs"
import { expect, test, vi } from "vitest"

import type { DiscogsRawRelease } from "./discogsApi.js"
import { mapDiscogsRelease } from "./discogsApi.js"
import {
  buildDiscogsIdentifiers,
  getDiscogsArtwork,
  getIsTitleMatch,
  selectDiscogsFrontImageUrl,
} from "./discogsArtwork.js"
import type { CachedFetch } from "./musicBrainzApi.js"

const buildRelease = (
  overrides: Partial<DiscogsRawRelease> = {},
) =>
  mapDiscogsRelease({
    id: 272692,
    images: [
      {
        height: 500,
        type: "primary",
        uri: "https://example.com/front.jpg",
        width: 500,
      },
    ],
    title: "Pulse",
    ...overrides,
  })

// A URL-keyed fetch, because one lookup is a search followed by a release.
const buildRoutedFetch = (
  bodiesByUrlFragment: Record<string, unknown>,
): CachedFetch =>
  vi.fn((url: string) =>
    ((entry) =>
      entry === undefined
        ? Promise.reject(new Error(`no stub for ${url}`))
        : Promise.resolve({
            body: JSON.stringify(entry[1]),
            isFromCache: false,
          }))(
      Object.entries(bodiesByUrlFragment).find(
        ([fragment]) => url.includes(fragment),
      ),
    ),
  )

test("takes the image Discogs marks as the front", () => {
  expect(
    selectDiscogsFrontImageUrl(
      buildRelease({
        images: [
          {
            type: "secondary",
            uri: "https://example.com/disc.jpg",
          },
          {
            type: "primary",
            uri: "https://example.com/front.jpg",
          },
        ],
      }),
    ),
  ).toBe("https://example.com/front.jpg")
})

// A release photographed by a contributor often has no primary image at all
// — the case, the disc and the inlay are all secondary, and the case is
// first. Refusing those would leave the album blank for no gain.
test("falls back to the first image when none is marked primary", () => {
  expect(
    selectDiscogsFrontImageUrl(
      buildRelease({
        images: [
          {
            type: "secondary",
            uri: "https://example.com/case.jpg",
          },
          {
            type: "secondary",
            uri: "https://example.com/disc.jpg",
          },
        ],
      }),
    ),
  ).toBe("https://example.com/case.jpg")
})

test("has no image to take when the release carries none", () => {
  expect(
    selectDiscogsFrontImageUrl(
      buildRelease({ images: [] }),
    ),
  ).toBeNull()
})

test("compares the release title with punctuation, case and spacing removed", () => {
  expect(
    getIsTitleMatch({
      albumTitle: "civil war: songs of the south",
      release: buildRelease({
        title: "Civil War - Songs Of The South",
      }),
    }),
  ).toBe(true)
})

test("asks for the barcode before any catalogue number", () => {
  expect(
    buildDiscogsIdentifiers({
      barcode: "030206066821",
      catalogNumbers: ["302 060 668 2", ""],
    }),
  ).toEqual([
    { identifier: "030206066821", kind: "barcode" },
    { identifier: "302 060 668 2", kind: "catno" },
  ])
})

test("asks for nothing when the release has neither identifier", () => {
  expect(
    buildDiscogsIdentifiers({
      barcode: "",
      catalogNumbers: [],
    }),
  ).toEqual([])
})

test("finds the front cover through the barcode", async () => {
  expect(
    await firstValueFrom(
      getDiscogsArtwork({
        albumTitle: "Pulse",
        barcode: "030206066821",
        cachedFetch: buildRoutedFetch({
          "/database/search": { results: [{ id: 272692 }] },
          "/releases/272692": {
            id: 272692,
            images: [
              {
                type: "primary",
                uri: "https://example.com/front.jpg",
              },
            ],
            title: "Pulse",
          },
        }),
      }),
    ),
  ).toEqual({
    imageUrl: "https://example.com/front.jpg",
    matchedBy: "barcode",
    releaseId: "272692",
  })
})

// The identifier found A release; it did not prove the release is this
// album. A barcode is reused across a reissue and a catalogue number is only
// unique within its label, so the title still has to agree.
test("refuses a release the identifier found but the title contradicts", async () => {
  expect(
    await firstValueFrom(
      getDiscogsArtwork({
        albumTitle: "Pulse",
        barcode: "030206066821",
        cachedFetch: buildRoutedFetch({
          "/database/search": { results: [{ id: 99 }] },
          "/releases/99": {
            id: 99,
            images: [
              {
                type: "primary",
                uri: "https://example.com/other.jpg",
              },
            ],
            title: "Something Else",
          },
        }),
      }),
    ),
  ).toBeNull()
})

test("tries the catalogue number when the barcode finds nothing", async () => {
  const cachedFetch = vi.fn((url: string) =>
    Promise.resolve({
      body: JSON.stringify(
        url.includes("/releases/272692")
          ? {
              id: 272692,
              images: [
                {
                  type: "primary",
                  uri: "https://example.com/front.jpg",
                },
              ],
              title: "Pulse",
            }
          : url.includes("catno")
            ? { results: [{ id: 272692 }] }
            : { results: [] },
      ),
      isFromCache: false,
    }),
  )

  expect(
    await firstValueFrom(
      getDiscogsArtwork({
        albumTitle: "Pulse",
        barcode: "0000000000000",
        cachedFetch,
        catalogNumbers: ["7930189041-2"],
      }),
    ),
  ).toEqual({
    imageUrl: "https://example.com/front.jpg",
    matchedBy: "catno",
    releaseId: "272692",
  })
})

test("asks Discogs nothing when the release has no identifier", async () => {
  const cachedFetch = vi.fn(() =>
    Promise.reject(new Error("should not be called")),
  )

  expect(
    await firstValueFrom(
      getDiscogsArtwork({
        albumTitle: "Pulse",
        cachedFetch,
      }),
    ),
  ).toBeNull()
  expect(cachedFetch).not.toHaveBeenCalled()
})

// One unreachable provider must not stop the chain reaching iTunes and then
// the art already sitting in the album folder.
test("returns nothing rather than failing when Discogs is unreachable", async () => {
  expect(
    await firstValueFrom(
      getDiscogsArtwork({
        albumTitle: "Pulse",
        barcode: "030206066821",
        cachedFetch: vi.fn(() =>
          Promise.reject(new Error("network down")),
        ),
      }),
    ),
  ).toBeNull()
})
