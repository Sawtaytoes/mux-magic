import { describe, expect, test } from "vitest"

import { mapTvdbSearchResults, type TvdbRawResult } from "./searchTvdb.js"

const baseRaw = (overrides: Partial<TvdbRawResult> = {}): TvdbRawResult => ({
  name: "Breaking Bad",
  tvdb_id: "1",
  ...overrides,
})

describe(mapTvdbSearchResults.name, () => {
  test("returns an empty array when given null", () => {
    expect(mapTvdbSearchResults(null)).toEqual([])
  })

  test("returns an empty array when given undefined", () => {
    expect(mapTvdbSearchResults(undefined)).toEqual([])
  })

  test("returns an empty array when given an empty array", () => {
    expect(mapTvdbSearchResults([])).toEqual([])
  })

  test("maps the canonical fields from a single raw result", () => {
    expect(mapTvdbSearchResults([
      baseRaw({
        image_url: "https://artworks.thetvdb.com/banners/series/81189/posters/12345.jpg",
        name: "Breaking Bad",
        status: "Ended",
        tvdb_id: "81189",
        year: "2008",
      }),
    ]))
    .toEqual([
      {
        imageUrl: "https://artworks.thetvdb.com/banners/series/81189/posters/12345.jpg",
        name: "Breaking Bad",
        status: "Ended",
        tvdbId: 81189,
        year: "2008",
      },
    ])
  })

  test("leaves status / year / imageUrl undefined when not provided", () => {
    const result = mapTvdbSearchResults([baseRaw({ tvdb_id: "1", name: "Minimal" })])[0]
    expect(result.imageUrl).toBeUndefined()
    expect(result.status).toBeUndefined()
    expect(result.year).toBeUndefined()
  })

  test("filters out entries missing tvdb_id (Number(undefined) is NaN, fails > 0)", () => {
    expect(mapTvdbSearchResults([
      baseRaw({ tvdb_id: undefined, name: "No ID" }),
      baseRaw({ tvdb_id: "7", name: "Has ID" }),
    ]))
    .toEqual([expect.objectContaining({ tvdbId: 7, name: "Has ID" })])
  })

  test("filters out entries whose tvdb_id is non-numeric", () => {
    expect(mapTvdbSearchResults([
      baseRaw({ tvdb_id: "garbage", name: "Bad" }),
      baseRaw({ tvdb_id: "12", name: "Good" }),
    ]))
    .toEqual([expect.objectContaining({ tvdbId: 12, name: "Good" })])
  })

  test("filters out entries with tvdb_id '0'", () => {
    expect(mapTvdbSearchResults([
      baseRaw({ tvdb_id: "0", name: "Zero ID" }),
      baseRaw({ tvdb_id: "5", name: "Real" }),
    ]))
    .toEqual([expect.objectContaining({ tvdbId: 5, name: "Real" })])
  })

  test("filters out entries with no name (so we don't surface empty-string options to the user)", () => {
    expect(mapTvdbSearchResults([
      baseRaw({ tvdb_id: "1", name: undefined }),
      baseRaw({ tvdb_id: "2", name: "" }),
      baseRaw({ tvdb_id: "3", name: "Real Name" }),
    ]))
    .toEqual([expect.objectContaining({ tvdbId: 3, name: "Real Name" })])
  })

  test("prefers the English translation over the canonical name (anime case)", () => {
    expect(mapTvdbSearchResults([
      baseRaw({
        tvdb_id: "76703",
        name: "ポケットモンスター",
        translations: { eng: "Pokémon", jpn: "ポケットモンスター" },
      }),
    ]))
    .toEqual([expect.objectContaining({ tvdbId: 76703, name: "Pokémon" })])
  })

  test("falls back to name_translated when translations.eng is missing", () => {
    expect(mapTvdbSearchResults([
      baseRaw({
        tvdb_id: "1",
        name: "Canonical",
        name_translated: "Translated",
      }),
    ]))
    .toEqual([expect.objectContaining({ name: "Translated" })])
  })

  test("falls back to canonical name when no translation is provided", () => {
    expect(mapTvdbSearchResults([
      baseRaw({
        tvdb_id: "1",
        name: "Canonical Only",
      }),
    ]))
    .toEqual([expect.objectContaining({ name: "Canonical Only" })])
  })

  test("preserves the original order of results that pass the filter", () => {
    expect(mapTvdbSearchResults([
      baseRaw({ tvdb_id: "3", name: "Third" }),
      baseRaw({ tvdb_id: "1", name: "First" }),
      baseRaw({ tvdb_id: "2", name: "Second" }),
    ])
    .map((r) => r.tvdbId))
    .toEqual([3, 1, 2])
  })
})
