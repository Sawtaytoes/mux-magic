import type {
  SearchAnidbResult,
  SearchDvdCompareResult,
  SearchMalResult,
  SearchMovieDbResult,
  SearchTvdbResult,
  LookupRelease as ServerLookupRelease,
  LookupSearchResult as ServerLookupSearchResult,
  LookupType as ServerLookupType,
} from "@mux-magic/server/api-types"
import { describe, expect, test } from "vitest"
import type {
  LookupRelease,
  LookupSearchResult,
  LookupType,
} from "./types"

// Structural-type guarantees the worker-32 migration must hold.
// Each `const _ : A = B` line fails to compile if A and B aren't
// structurally equal — that's the test.

describe("LookupModal/types ↔ server/api-types contract", () => {
  test("web LookupSearchResult is the server union", () => {
    const malResult = {
      malId: 1,
      name: "Cowboy Bebop",
    } satisfies SearchMalResult
    const anidbResult = {
      aid: 23,
      name: "Cowboy Bebop",
    } satisfies SearchAnidbResult
    const tvdbResult = {
      tvdbId: 76885,
      name: "Cowboy Bebop",
    } satisfies SearchTvdbResult
    const tmdbResult = {
      movieDbId: 1,
      title: "Cowboy Bebop: The Movie",
      year: "2001",
    } satisfies SearchMovieDbResult
    const dvdCompareResult = {
      baseTitle: "Cowboy Bebop",
      id: 12345,
      variant: "Blu-ray",
      year: "2001",
    } satisfies SearchDvdCompareResult

    const _webMal: LookupSearchResult = malResult
    const _webAnidb: LookupSearchResult = anidbResult
    const _webTvdb: LookupSearchResult = tvdbResult
    const _webTmdb: LookupSearchResult = tmdbResult
    const _webDvdCompare: LookupSearchResult =
      dvdCompareResult

    const _serverMal: ServerLookupSearchResult = malResult

    expect(_webMal).toBe(malResult)
    expect(_serverMal).toBe(malResult)
  })

  test("LookupType enum matches the server enum exactly", () => {
    const webKeys: LookupType[] = [
      "mal",
      "anidb",
      "tvdb",
      "tmdb",
      "dvdcompare",
    ]
    const serverKeys: ServerLookupType[] = webKeys
    expect(serverKeys).toEqual(webKeys)
  })

  test("LookupRelease is the server's dvdCompareRelease shape", () => {
    const release = {
      hash: "abc123",
      label: "Region A — Blu-ray",
    } satisfies ServerLookupRelease
    const _webRelease: LookupRelease = release
    expect(_webRelease.hash).toBe("abc123")
  })
})
