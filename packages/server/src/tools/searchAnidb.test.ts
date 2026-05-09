import { join } from "node:path"

import { describe, expect, test, vi } from "vitest"

import { findAnimeByQuery, parseAnimeIndex, type AnimeIndexEntry } from "./animeOfflineDatabase.js"
import { parseAnidbAnimeXml } from "./searchAnidb.js"

// Real AniDB XML fixtures captured by scripts/seedAnidbFixtures.ts. Re-run
// that script to refresh when AniDB changes a response shape.
//
// vitest.setup.ts mocks node:fs globally with memfs, so use vi.importActual
// to read the on-disk fixtures at module init.
const realFs = await vi.importActual<typeof import("node:fs")>("node:fs")
const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__")
const loadFixture = (rel: string): string => (
  realFs.readFileSync(join(FIXTURES_DIR, rel), "utf8")
)

describe(parseAnimeIndex.name, () => {
  test("extracts aid from anidb.net source URLs and preserves title/type/episodes", () => {
    const json = loadFixture("manami/manami-sample.json")
    const index = parseAnimeIndex(json)

    expect(index).toHaveLength(3)
    expect(index[0]).toMatchObject({ aid: 8160, name: "Fate/Zero", type: "TV", episodes: 13 })
    expect(index[1]).toMatchObject({ aid: 3348, name: "Fate/stay night", type: "TV", episodes: 24 })
    expect(index[2]).toMatchObject({ aid: 23, name: "Cowboy Bebop", type: "TV", episodes: 26 })
  })

  test("skips entries that have no anidb.net source URL", () => {
    const json = loadFixture("manami/manami-sample.json")
    const index = parseAnimeIndex(json)

    // The fixture has 5 raw entries; only 3 have anidb.net sources.
    expect(index.every((e) => e.aid > 0)).toBe(true)
    expect(index.find((e) => e.name === "No AniDB Source Anime")).toBeUndefined()
    expect(index.find((e) => e.name === "Empty Sources Anime")).toBeUndefined()
  })

  test("builds a lowercased haystack from title + synonyms for substring matching", () => {
    const json = loadFixture("manami/manami-sample.json")
    const index = parseAnimeIndex(json)
    const fateZero = index.find((e) => e.aid === 8160)!

    expect(fateZero.matchHaystack).toContain("fate/zero")
    expect(fateZero.matchHaystack).toContain("fate zero")
    // Original-case in haystack would be a bug — search needle is lowercased.
    expect(fateZero.matchHaystack).not.toContain("Fate/Zero")
  })
})

describe(findAnimeByQuery.name, () => {
  const sampleIndex: AnimeIndexEntry[] = [
    { aid: 8160, name: "Fate/Zero", matchHaystack: "fate/zero\nfate zero", type: "TV", episodes: 13 },
    { aid: 3348, name: "Fate/stay night", matchHaystack: "fate/stay night\nfate stay night", type: "TV", episodes: 24 },
    { aid: 23, name: "Cowboy Bebop", matchHaystack: "cowboy bebop", type: "TV", episodes: 26 },
  ]

  test("returns matches by title substring", () => {
    expect(findAnimeByQuery(sampleIndex, "fate")).toHaveLength(2)
    expect(findAnimeByQuery(sampleIndex, "cowboy")).toHaveLength(1)
  })

  test("matches synonyms via the haystack", () => {
    const hits = findAnimeByQuery(sampleIndex, "fate zero")
    expect(hits).toHaveLength(1)
    expect(hits[0].aid).toBe(8160)
  })

  test("is case-insensitive", () => {
    expect(findAnimeByQuery(sampleIndex, "COWBOY")).toHaveLength(1)
    expect(findAnimeByQuery(sampleIndex, "Fate")).toHaveLength(2)
  })

  test("respects the limit argument", () => {
    expect(findAnimeByQuery(sampleIndex, "fate", 1)).toHaveLength(1)
  })

  test("returns empty array for an empty or whitespace-only query", () => {
    expect(findAnimeByQuery(sampleIndex, "")).toEqual([])
    expect(findAnimeByQuery(sampleIndex, "   ")).toEqual([])
  })

  test("returns empty array when nothing matches", () => {
    expect(findAnimeByQuery(sampleIndex, "naruto")).toEqual([])
  })
})

describe(parseAnidbAnimeXml.name, () => {
  test("parses a real anime payload (aid 7206) into the expected shape", () => {
    const xml = loadFixture("anidb/anime/7206.xml")
    const result = parseAnidbAnimeXml(xml)

    expect(result).not.toBeNull()
    expect(result!.aid).toBe(7206)
    expect(result!.titles.length).toBeGreaterThan(0)
    expect(result!.episodes.length).toBeGreaterThan(0)

    for (const t of result!.titles) {
      expect(t.lang.length).toBeGreaterThan(0)
      expect(t.value.length).toBeGreaterThan(0)
      expect(["main", "synonym", "short", "official"]).toContain(t.type)
    }

    for (const ep of result!.episodes) {
      expect(typeof ep.epno).toBe("string")
      expect(ep.epno.length).toBeGreaterThan(0)
      expect([1, 2, 3, 4, 5, 6]).toContain(ep.type)
      if (ep.airdate !== undefined) expect(typeof ep.airdate).toBe("string")
      if (ep.length !== undefined) expect(typeof ep.length).toBe("number")
    }
  })

  test("aid 11370 includes both regular (type 1) and O-prefixed (type 6) episodes", () => {
    const xml = loadFixture("anidb/anime/11370.xml")
    const result = parseAnidbAnimeXml(xml)

    expect(result).not.toBeNull()
    expect(result!.aid).toBe(11370)

    const regulars = result!.episodes.filter((ep) => ep.type === 1)
    const others = result!.episodes.filter((ep) => ep.type === 6)

    expect(regulars.length).toBeGreaterThan(0)
    expect(others.length).toBeGreaterThan(0)

    for (const ep of regulars) expect(ep.epno).toMatch(/^\d+$/)
    for (const ep of others) expect(ep.epno).toMatch(/^O/i)
  })

  test("preserves multi-language episode titles", () => {
    const xml = loadFixture("anidb/anime/7206.xml")
    const result = parseAnidbAnimeXml(xml)
    const someEpisode = result!.episodes[0]
    expect(someEpisode.titles.length).toBeGreaterThan(0)
    expect(someEpisode.titles.every((t) => t.lang.length > 0)).toBe(true)
  })

  test("handles episodes with missing optional fields", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <anime id="100">
        <titles>
          <title xml:lang="x-jat" type="main">X</title>
        </titles>
        <episodes>
          <episode>
            <epno type="1">1</epno>
          </episode>
        </episodes>
      </anime>
    `
    const result = parseAnidbAnimeXml(xml)
    expect(result?.episodes[0]).toEqual({
      airdate: undefined,
      epno: "1",
      length: undefined,
      titles: [],
      type: 1,
    })
  })

  test("returns null when XML has no <anime> root (e.g., AniDB error response)", () => {
    expect(parseAnidbAnimeXml("<error>banned</error>")).toBeNull()
  })
})
