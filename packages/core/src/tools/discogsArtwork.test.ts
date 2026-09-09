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
            height: 500,
            type: "secondary",
            uri: "https://example.com/disc.jpg",
            width: 500,
          },
          {
            height: 500,
            type: "primary",
            uri: "https://example.com/front.jpg",
            width: 500,
          },
        ],
      }),
    ),
  ).toBe("https://example.com/front.jpg")
})

// A release photographed by a contributor often has no primary image at all
// — the case, the disc and the inlay are all secondary. The largest square
// one is taken rather than the first, because refusing them all would leave
// the album blank for no gain.
test("takes the largest square image when none is marked primary", () => {
  expect(
    selectDiscogsFrontImageUrl(
      buildRelease({
        images: [
          {
            height: 300,
            type: "secondary",
            uri: "https://example.com/small.jpg",
            width: 300,
          },
          {
            height: 900,
            type: "secondary",
            uri: "https://example.com/large.jpg",
            width: 900,
          },
        ],
      }),
    ),
  ).toBe("https://example.com/large.jpg")
})

// Real data: Lambert, Hendricks & Ross — *The Best of the Best!* on Discogs
// carries one image, marked primary, and it is a 600x281 scan of the back
// tray beside the front. It went onto the album before this check existed.
test("refuses a wide scan of the back and front laid side by side", () => {
  expect(
    selectDiscogsFrontImageUrl(
      buildRelease({
        images: [
          {
            height: 281,
            type: "primary",
            uri: "https://example.com/spread.jpg",
            width: 600,
          },
        ],
      }),
    ),
  ).toBeNull()
})

// Real data: *Feel Good Rock: Songs You Know by Heart* — one secondary
// image, 600x450, a photograph of the jewel case on a desk with a shop's
// price sticker on it. 4:3 is a camera's aspect ratio, not a cover's.
test("refuses a 4:3 photograph of the case", () => {
  expect(
    selectDiscogsFrontImageUrl(
      buildRelease({
        images: [
          {
            height: 450,
            type: "secondary",
            uri: "https://example.com/case-photo.jpg",
            width: 600,
          },
        ],
      }),
    ),
  ).toBeNull()
})

// Discogs does not always record the dimensions. Without them the shape
// cannot be checked, and an unchecked image is the thing this guard exists
// to stop.
test("refuses an image whose dimensions Discogs does not give", () => {
  expect(
    selectDiscogsFrontImageUrl(
      buildRelease({
        images: [
          {
            type: "primary",
            uri: "https://example.com/unknown-size.jpg",
          },
        ],
      }),
    ),
  ).toBeNull()
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

// Real data: the tags carry the romanisation and Discogs carries both.
test("matches a romanised title against a bracketed native title", () => {
  expect(
    getIsTitleMatch({
      albumTitle: "Chara no Mori",
      release: buildRelease({
        title: "Chara No Mori (チャラの森)",
      }),
    }),
  ).toBe(true)
})

test("matches a title written entirely in Japanese", () => {
  expect(
    getIsTitleMatch({
      albumTitle: "恋恋風歌",
      release: buildRelease({ title: "恋恋風歌" }),
    }),
  ).toBe(true)
})

// The old comparison kept only `a-z0-9`, so both of these normalised to the
// empty string and the check passed. Two different Japanese albums on one
// label share a catalogue-number prefix, so a vacuous title check is exactly
// where a wrong cover would come from.
test("refuses two different Japanese titles that share no characters", () => {
  expect(
    getIsTitleMatch({
      albumTitle: "つぼみ",
      release: buildRelease({ title: "シナリオ" }),
    }),
  ).toBe(false)
})

test("refuses a title that has nothing left to compare", () => {
  expect(
    getIsTitleMatch({
      albumTitle: "???",
      release: buildRelease({ title: "!!!" }),
    }),
  ).toBe(false)
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
                height: 500,
                type: "primary",
                uri: "https://example.com/front.jpg",
                width: 500,
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
                height: 500,
                type: "primary",
                uri: "https://example.com/other.jpg",
                width: 500,
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
                  height: 500,
                  type: "primary",
                  uri: "https://example.com/front.jpg",
                  width: 500,
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
