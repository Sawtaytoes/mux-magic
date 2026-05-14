import { describe, expect, test } from "vitest"

import {
  type JikanAnimeRow,
  mapJikanSearchResults,
} from "./searchMal.js"

const baseRow = (
  overrides: Partial<JikanAnimeRow> = {},
): JikanAnimeRow => ({
  mal_id: 1,
  title: "Cowboy Bebop",
  ...overrides,
})

describe(mapJikanSearchResults.name, () => {
  test("returns an empty array when given no rows", () => {
    expect(mapJikanSearchResults([])).toEqual([])
    expect(mapJikanSearchResults(null)).toEqual([])
    expect(mapJikanSearchResults(undefined)).toEqual([])
  })

  test("prefers title_english as the display name and surfaces romaji `title` as a subtitle", () => {
    expect(
      mapJikanSearchResults([
        baseRow({
          mal_id: 39534,
          title: "Jibaku Shounen Hanako-kun",
          title_english: "Toilet-Bound Hanako-kun",
          // We deliberately do NOT surface title_japanese (kanji) — the
          // subtitle is romaji so users typing into a Latin-script search
          // box can recognize it.
          title_japanese: "地縛少年花子くん",
          aired: {
            from: "2020-01-10T00:00:00+00:00",
            prop: { from: { year: 2020 } },
          },
          type: "TV",
        }),
      ]),
    ).toEqual([
      {
        airDate: undefined,
        imageUrl: undefined,
        malId: 39534,
        mediaType: "TV",
        name: "Toilet-Bound Hanako-kun",
        nameJapanese: "Jibaku Shounen Hanako-kun",
        year: "2020",
      },
    ])
  })

  test("falls back to title (romaji) when title_english is missing", () => {
    expect(
      mapJikanSearchResults([
        baseRow({
          mal_id: 1,
          title: "Cowboy Bebop",
          title_english: null,
        }),
      ])[0].name,
    ).toBe("Cowboy Bebop")
  })

  test("suppresses nameJapanese when romaji `title` duplicates the chosen display name", () => {
    // When title_english is missing, romaji falls in as the primary name
    // and there's no useful subtitle to show — same string.
    expect(
      mapJikanSearchResults([
        baseRow({
          mal_id: 1,
          title: "Cowboy Bebop",
          title_english: null,
        }),
      ])[0].nameJapanese,
    ).toBeUndefined()
  })

  test("parses year from aired.prop.from.year", () => {
    expect(
      mapJikanSearchResults([
        baseRow({
          aired: { prop: { from: { year: 1998 } } },
        }),
      ])[0].year,
    ).toBe("1998")
  })

  test("falls back to parsing 4-digit prefix of aired.from when prop.year is absent", () => {
    expect(
      mapJikanSearchResults([
        baseRow({ aired: { from: "1999-04-03T00:00:00" } }),
      ])[0].year,
    ).toBe("1999")
  })

  test("leaves year undefined when neither prop.year nor parseable from is present", () => {
    expect(
      mapJikanSearchResults([baseRow({ aired: undefined })])[0]
        .year,
    ).toBeUndefined()
  })

  test("filters out rows with malId 0 or with no usable name", () => {
    expect(
      mapJikanSearchResults([
        baseRow({
          mal_id: 0,
          title: "Bogus",
        }),
        baseRow({
          mal_id: 5,
          title: undefined,
          title_english: null,
          title_japanese: null,
        }),
        baseRow({ mal_id: 7, title: "Real" }),
      ]),
    ).toEqual([
      expect.objectContaining({ malId: 7, name: "Real" }),
    ])
  })

  test("uses the small thumbnail when available, falling back to image_url", () => {
    expect(
      mapJikanSearchResults([
        baseRow({
          images: {
            jpg: {
              small_image_url: "https://cdn/img-thumb.jpg",
              image_url: "https://cdn/img.jpg",
            },
          },
        }),
      ])[0].imageUrl,
    ).toBe("https://cdn/img-thumb.jpg")
    expect(
      mapJikanSearchResults([
        baseRow({
          images: { jpg: { image_url: "https://cdn/img.jpg" } },
        }),
      ])[0].imageUrl,
    ).toBe("https://cdn/img.jpg")
  })
})
