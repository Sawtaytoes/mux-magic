import { firstValueFrom, of, throwError } from "rxjs"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { canonicalizeMovieTitle } from "./canonicalizeMovieTitle.js"

vi.mock("./searchMovieDb.js", () => ({
  searchMovieDb: vi.fn(),
}))

const { searchMovieDb } = await import("./searchMovieDb.js")

const mockSearchResults = (results: Array<{ movieDbId: number; title: string; year: string }>) => {
  vi.mocked(searchMovieDb).mockReturnValue(
    of(results.map((r) => ({ ...r, imageUrl: undefined, overview: undefined }))),
  )
}

describe(canonicalizeMovieTitle.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("strips ' AKA …' aliases before sending the title to TMDB", async () => {
    mockSearchResults([{ movieDbId: 1, title: "Dragon Lord", year: "1982" }])

    await firstValueFrom(canonicalizeMovieTitle({
      dvdCompareBaseTitle: "Dragon Lord AKA Long xiao ye AKA Dragon Strike",
      dvdCompareYear: "1982",
    }))

    expect(vi.mocked(searchMovieDb)).toHaveBeenCalledWith("Dragon Lord", "1982")
  })

  test("returns the first TMDB result's title + year when one is found", async () => {
    mockSearchResults([
      { movieDbId: 64720, title: "Dragon Lord", year: "1982" },
      { movieDbId: 99999, title: "Some other movie", year: "2020" },
    ])

    expect(await firstValueFrom(canonicalizeMovieTitle({
      dvdCompareBaseTitle: "Dragon Lord AKA Long xiao ye",
      dvdCompareYear: "1982",
    }))).toEqual({ title: "Dragon Lord", year: "1982" })
  })

  test("falls back to the cleaned DVDCompare title + parsed year when TMDB returns no results", async () => {
    mockSearchResults([])

    expect(await firstValueFrom(canonicalizeMovieTitle({
      dvdCompareBaseTitle: "Some Obscure Film AKA Foreign Title",
      dvdCompareYear: "1955",
    }))).toEqual({ title: "Some Obscure Film", year: "1955" })
  })

  test("falls back when searchMovieDb itself errors out (network / missing API key)", async () => {
    vi.mocked(searchMovieDb).mockReturnValue(throwError(() => new Error("TMDB unreachable")))

    expect(await firstValueFrom(canonicalizeMovieTitle({
      dvdCompareBaseTitle: "Soldier",
      dvdCompareYear: "1998",
    }))).toEqual({ title: "Soldier", year: "1998" })
  })

  test("prefers TMDB's year, but falls back to the parsed year when TMDB has no release date", async () => {
    mockSearchResults([{ movieDbId: 1, title: "Some Film", year: "" }])

    expect(await firstValueFrom(canonicalizeMovieTitle({
      dvdCompareBaseTitle: "Some Film",
      dvdCompareYear: "1972",
    }))).toEqual({ title: "Some Film", year: "1972" })
  })

  test("returns the fallback (and skips TMDB) when the input title is empty after AKA-strip", async () => {
    expect(await firstValueFrom(canonicalizeMovieTitle({
      dvdCompareBaseTitle: "",
      dvdCompareYear: "",
    }))).toEqual({ title: "", year: "" })
    expect(vi.mocked(searchMovieDb)).not.toHaveBeenCalled()
  })
})
