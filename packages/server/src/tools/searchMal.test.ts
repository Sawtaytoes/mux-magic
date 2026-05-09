import { describe, expect, test } from "vitest"

import { mapMalSearchResults, type MalRawResult } from "./searchMal.js"

const baseRaw = (overrides: Partial<MalRawResult> = {}): MalRawResult => ({
  id: "1",
  name: "Cowboy Bebop",
  ...overrides,
})

describe(mapMalSearchResults.name, () => {
  test("returns an empty array when given no raw results", () => {
    expect(mapMalSearchResults([])).toEqual([])
  })

  test("maps the canonical fields from a single raw result", () => {
    expect(mapMalSearchResults([
      baseRaw({
        id: "42",
        image_url: "https://cdn.example.com/img-fallback.jpg",
        name: "Cowboy Bebop",
        payload: { aired: "Apr 1998 - Apr 1999", media_type: "TV" },
        thumbnail_url: "https://cdn.example.com/thumb.jpg",
      }),
    ]))
    .toEqual([
      {
        airDate: "Apr 1998 - Apr 1999",
        imageUrl: "https://cdn.example.com/thumb.jpg",
        malId: 42,
        mediaType: "TV",
        name: "Cowboy Bebop",
      },
    ])
  })

  test("uses image_url as the fallback when thumbnail_url is missing", () => {
    expect(mapMalSearchResults([
      baseRaw({
        id: "1",
        image_url: "https://cdn.example.com/img.jpg",
      }),
    ]))
    .toEqual([
      expect.objectContaining({
        imageUrl: "https://cdn.example.com/img.jpg",
      }),
    ])
  })

  test("leaves imageUrl undefined when both URL fields are missing", () => {
    expect(mapMalSearchResults([
      baseRaw({ id: "1" }),
    ])[0].imageUrl)
    .toBeUndefined()
  })

  test("leaves airDate and mediaType undefined when payload is missing", () => {
    const result = mapMalSearchResults([baseRaw({ id: "1" })])[0]
    expect(result.airDate).toBeUndefined()
    expect(result.mediaType).toBeUndefined()
  })

  test("filters out entries with id '0' (treated as invalid)", () => {
    expect(mapMalSearchResults([
      baseRaw({ id: "0", name: "Bogus" }),
      baseRaw({ id: "5", name: "Real" }),
    ]))
    .toEqual([expect.objectContaining({ malId: 5, name: "Real" })])
  })

  test("filters out entries whose id is not numeric (Number() yields NaN)", () => {
    expect(mapMalSearchResults([
      baseRaw({ id: "abc", name: "Garbage" }),
      baseRaw({ id: "7", name: "Valid" }),
    ]))
    .toEqual([expect.objectContaining({ malId: 7, name: "Valid" })])
  })

  test("preserves the original order of results that pass the filter", () => {
    expect(mapMalSearchResults([
      baseRaw({ id: "3", name: "Third" }),
      baseRaw({ id: "1", name: "First" }),
      baseRaw({ id: "2", name: "Second" }),
    ])
    .map((r) => r.malId))
    .toEqual([3, 1, 2])
  })
})
