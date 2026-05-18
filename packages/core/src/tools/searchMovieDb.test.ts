import { captureConsoleMessage } from "@mux-magic/tools"
import { firstValueFrom } from "rxjs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import {
  lookupMovieDbById,
  type MovieDbRawSearchResult,
  mapTmdbSearchResults,
  searchMovieDb,
} from "./searchMovieDb.js"

describe(mapTmdbSearchResults.name, () => {
  test("maps the documented TMDB search-result fields onto our public shape", () => {
    const raw: MovieDbRawSearchResult[] = [
      {
        id: 49047,
        title: "Gravity",
        release_date: "2013-10-04",
        poster_path: "/abc.jpg",
        overview: "A medical engineer...",
      },
    ]
    expect(mapTmdbSearchResults(raw)).toEqual([
      {
        movieDbId: 49047,
        title: "Gravity",
        year: "2013",
        imageUrl: "https://image.tmdb.org/t/p/w185/abc.jpg",
        overview: "A medical engineer...",
      },
    ])
  })

  test("treats a null/undefined input as an empty list (TMDB empty-search response)", () => {
    expect(mapTmdbSearchResults(null)).toEqual([])
    expect(mapTmdbSearchResults(undefined)).toEqual([])
  })

  test("drops entries with missing or zero ids and missing titles", () => {
    expect(
      mapTmdbSearchResults([
        {
          id: 0,
          title: "Anonymous",
          release_date: "2011-10-28",
        },
        { id: 100, title: "", release_date: "2020-01-01" },
        {
          id: 200,
          title: "Inception",
          release_date: "2010-07-15",
        },
      ]),
    ).toEqual([
      {
        movieDbId: 200,
        title: "Inception",
        year: "2010",
        imageUrl: undefined,
        overview: undefined,
      },
    ])
  })

  test("leaves year blank when release_date is missing or shorter than YYYY", () => {
    expect(
      mapTmdbSearchResults([
        { id: 1, title: "A", release_date: "" },
        { id: 2, title: "B" },
        { id: 3, title: "C", release_date: "abc" },
      ]),
    ).toEqual([
      {
        movieDbId: 1,
        title: "A",
        year: "",
        imageUrl: undefined,
        overview: undefined,
      },
      {
        movieDbId: 2,
        title: "B",
        year: "",
        imageUrl: undefined,
        overview: undefined,
      },
      // Even though "abc" is 3 chars (below the YYYY threshold), the impl
      // is permissive — yearOf slices the first 4 chars when length >= 4.
      // 3-char garbage drops to "".
      {
        movieDbId: 3,
        title: "C",
        year: "",
        imageUrl: undefined,
        overview: undefined,
      },
    ])
  })

  test("omits imageUrl when poster_path is missing or null", () => {
    expect(
      mapTmdbSearchResults([
        {
          id: 1,
          title: "A",
          release_date: "2020-01-01",
          poster_path: null,
        },
        { id: 2, title: "B", release_date: "2020-01-01" },
      ]).map((result) => result.imageUrl),
    ).toEqual([undefined, undefined])
  })
})

describe("searchMovieDb (network)", () => {
  const originalApiKey = process.env.TMDB_API_KEY
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.TMDB_API_KEY = "test-token"
  })

  afterEach(() => {
    process.env.TMDB_API_KEY = originalApiKey
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  test("appends &year= when a year is provided so TMDB disambiguates same-titled films", async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                id: 9425,
                title: "Soldier",
                release_date: "1998-10-23",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch

    await firstValueFrom(searchMovieDb("Soldier", "1998"))

    const [url] = fetchSpy.mock.calls[0] as unknown as [
      string,
    ]
    expect(url).toBe(
      "https://api.themoviedb.org/3/search/movie?query=Soldier&include_adult=false&language=en-US&page=1&year=1998",
    )
  })

  test("hits /search/movie with the bearer token + url-encoded query", async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                id: 1,
                title: "Test",
                release_date: "2024-01-01",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch

    const results = await firstValueFrom(
      searchMovieDb("Some Movie"),
    )

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock
      .calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(
      "https://api.themoviedb.org/3/search/movie?query=Some%20Movie&include_adult=false&language=en-US&page=1",
    )
    expect(
      (init.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer test-token")
    expect(results).toEqual([
      {
        movieDbId: 1,
        title: "Test",
        year: "2024",
        imageUrl: undefined,
        overview: undefined,
      },
    ])
  })

  test("surfaces a 401 from TMDB through logAndSwallowPipelineError (logs + completes empty)", async () =>
    captureConsoleMessage("error", async () => {
      globalThis.fetch = (async () =>
        new Response("Invalid API key.", {
          status: 401,
        })) as unknown as typeof globalThis.fetch

      // logAndSwallowPipelineError swallows the error into EMPTY, so firstValueFrom on
      // toArray() gives an empty result without throwing. The error message
      // is logged via console.error, which captureConsoleMessage silences.
      const { toArray } = await import("rxjs")
      const results = await firstValueFrom(
        searchMovieDb("Anything").pipe(toArray()),
      )
      expect(results).toEqual([])
    }))

  test("requires TMDB_API_KEY to be set; missing key fails the observable", async () =>
    captureConsoleMessage("error", async () => {
      delete process.env.TMDB_API_KEY
      const { toArray } = await import("rxjs")
      const results = await firstValueFrom(
        searchMovieDb("Anything").pipe(toArray()),
      )
      expect(results).toEqual([])
    }))
})

describe("lookupMovieDbById (network)", () => {
  const originalApiKey = process.env.TMDB_API_KEY
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.TMDB_API_KEY = "test-token"
  })

  afterEach(() => {
    process.env.TMDB_API_KEY = originalApiKey
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  test("hits /movie/<id> and packs the title+year into a single companion-name string", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: 49047,
          title: "Gravity",
          release_date: "2013-10-04",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )) as unknown as typeof globalThis.fetch

    const result = await firstValueFrom(
      lookupMovieDbById(49047),
    )
    expect(result).toEqual({ name: "Gravity (2013)" })
  })

  test("falls back to the bare title when TMDB has no release date for the film", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: 1,
          title: "Untitled",
          release_date: "",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )) as unknown as typeof globalThis.fetch

    expect(
      await firstValueFrom(lookupMovieDbById(1)),
    ).toEqual({ name: "Untitled" })
  })

  test("returns null when TMDB returns a body with no title (e.g. soft-404)", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: 999,
          title: "",
          release_date: "",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )) as unknown as typeof globalThis.fetch

    expect(
      await firstValueFrom(lookupMovieDbById(999)),
    ).toBeNull()
  })
})
