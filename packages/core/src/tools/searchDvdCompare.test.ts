import { join } from "node:path"

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
  displayDvdCompareVariant,
  findDvdCompareResults,
  parseDvdCompareFilmTitle,
  parseDvdCompareReleasesHtml,
  parseDvdCompareSearchHtml,
  parseDvdCompareTitleText,
} from "./searchDvdCompare.js"

// vitest.setup.ts mocks node:fs globally with memfs, so use vi.importActual
// to read on-disk fixtures at module init (same pattern as searchAnidb.test.ts).
const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")
const FIXTURES_DIR = join(
  import.meta.dirname,
  "__fixtures__",
)
const loadFixture = (rel: string): string =>
  realFs.readFileSync(join(FIXTURES_DIR, rel), "utf8")

describe(parseDvdCompareTitleText.name, () => {
  test("parses bare title with year as DVD variant", () => {
    expect(
      parseDvdCompareTitleText("Soldier (1998)", 123),
    ).toEqual({
      id: 123,
      baseTitle: "Soldier",
      variant: "DVD",
      year: "1998",
    })
  })

  test("extracts Blu-ray variant from parenthetical token", () => {
    expect(
      parseDvdCompareTitleText(
        "Soldier (Blu-ray) (1998)",
        124,
      ),
    ).toEqual({
      id: 124,
      baseTitle: "Soldier",
      variant: "Blu-ray",
      year: "1998",
    })
  })

  test("extracts Blu-ray 4K variant from parenthetical token", () => {
    expect(
      parseDvdCompareTitleText(
        "Soldier (Blu-ray 4K) (1998)",
        125,
      ),
    ).toEqual({
      id: 125,
      baseTitle: "Soldier",
      variant: "Blu-ray 4K",
      year: "1998",
    })
  })

  test("falls back to raw text and DVD when no year in parentheses", () => {
    expect(
      parseDvdCompareTitleText("Some Random String", 200),
    ).toEqual({
      id: 200,
      baseTitle: "Some Random String",
      variant: "DVD",
      year: "",
    })
  })

  test("preserves multi-word titles before the variant token", () => {
    expect(
      parseDvdCompareTitleText(
        "The Lord of the Rings (Blu-ray) (2001)",
        300,
      ),
    ).toEqual({
      id: 300,
      baseTitle: "The Lord of the Rings",
      variant: "Blu-ray",
      year: "2001",
    })
  })
})

describe(parseDvdCompareSearchHtml.name, () => {
  test("returns an empty array for empty HTML", () => {
    expect(parseDvdCompareSearchHtml("")).toEqual([])
  })

  test("returns an empty array when no film links are present", () => {
    expect(
      parseDvdCompareSearchHtml(
        '<html><body><a href="/about.php">About</a></body></html>',
      ),
    ).toEqual([])
  })

  test("extracts a single film link", () => {
    const html = `<a href="film.php?fid=12345">Soldier (1998)</a>`

    expect(parseDvdCompareSearchHtml(html)).toEqual([
      {
        id: 12345,
        baseTitle: "Soldier",
        variant: "DVD",
        year: "1998",
      },
    ])
  })

  test("extracts all variants of a film and preserves order", () => {
    const html = `
      <a href="film.php?fid=1001">Soldier (1998)</a>
      <a href="film.php?fid=1002">Soldier (Blu-ray) (1998)</a>
      <a href="film.php?fid=1003">Soldier (Blu-ray 4K) (1998)</a>
    `

    expect(parseDvdCompareSearchHtml(html)).toEqual([
      {
        id: 1001,
        baseTitle: "Soldier",
        variant: "DVD",
        year: "1998",
      },
      {
        id: 1002,
        baseTitle: "Soldier",
        variant: "Blu-ray",
        year: "1998",
      },
      {
        id: 1003,
        baseTitle: "Soldier",
        variant: "Blu-ray 4K",
        year: "1998",
      },
    ])
  })

  test("decodes common HTML entities in titles", () => {
    const html = `<a href="film.php?fid=42">Tom &amp; Jerry (Blu-ray) (1992)</a>`

    expect(parseDvdCompareSearchHtml(html)).toEqual([
      {
        id: 42,
        baseTitle: "Tom & Jerry",
        variant: "Blu-ray",
        year: "1992",
      },
    ])
  })

  test("ignores non-film anchor tags interleaved with film links", () => {
    const html = `
      <a href="/about.php">About</a>
      <a href="film.php?fid=7">Movie A (2020)</a>
      <a href="search.php">Search</a>
      <a href="film.php?fid=8">Movie B (2021)</a>
    `

    expect(parseDvdCompareSearchHtml(html)).toEqual([
      {
        id: 7,
        baseTitle: "Movie A",
        variant: "DVD",
        year: "2020",
      },
      {
        id: 8,
        baseTitle: "Movie B",
        variant: "DVD",
        year: "2021",
      },
    ])
  })

  test("handles single-quoted href attributes", () => {
    const html = `<a href='film.php?fid=99'>Quoted (2010)</a>`

    expect(parseDvdCompareSearchHtml(html)).toEqual([
      {
        id: 99,
        baseTitle: "Quoted",
        variant: "DVD",
        year: "2010",
      },
    ])
  })

  test("filters out fid=0 entries", () => {
    const html = `
      <a href="film.php?fid=0">Bogus (2000)</a>
      <a href="film.php?fid=5">Real (2005)</a>
    `

    expect(parseDvdCompareSearchHtml(html)).toEqual([
      {
        id: 5,
        baseTitle: "Real",
        variant: "DVD",
        year: "2005",
      },
    ])
  })
})

describe(parseDvdCompareReleasesHtml.name, () => {
  test("returns an empty array for empty HTML", () => {
    expect(parseDvdCompareReleasesHtml("")).toEqual([])
  })

  test("parses each <input> + sibling <a> as a separate release", () => {
    // Real-world HTML sample from a DVDCompare film page.
    const html = `<p>
        <input type="checkbox" name="1" checked=""> <a href="#1">Blu-ray ALL America - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br><input type="checkbox" name="2" checked=""> <a href="#2">Blu-ray ALL Canada - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br><input type="checkbox" name="3" checked=""> <a href="#3">Blu-ray ALL United Kingdom - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br>
        <br>
        <input type="hidden" name="sel" value="on">
        <input type="submit" name="submit" value="Apply Filter">
    </p>`

    expect(parseDvdCompareReleasesHtml(html)).toEqual([
      {
        hash: "1",
        label:
          "Blu-ray ALL America - Arrow Films - Limited Edition [2026]",
      },
      {
        hash: "2",
        label:
          "Blu-ray ALL Canada - Arrow Films - Limited Edition [2026]",
      },
      {
        hash: "3",
        label:
          "Blu-ray ALL United Kingdom - Arrow Films - Limited Edition [2026]",
      },
    ])
  })

  test("ignores hidden and submit inputs (non-numeric names)", () => {
    const html = `
      <input type="hidden" name="sel" value="on">
      <input type="checkbox" name="1"> <a href="#1">Only Real Release</a>
      <input type="submit" name="submit" value="Apply Filter">
    `

    expect(parseDvdCompareReleasesHtml(html)).toEqual([
      { hash: "1", label: "Only Real Release" },
    ])
  })

  test("decodes HTML entities and collapses whitespace inside labels", () => {
    const html = `<input type="checkbox" name="7"> <a href="#7">Tom &amp; Jerry  Special  Edition</a>`

    expect(parseDvdCompareReleasesHtml(html)).toEqual([
      { hash: "7", label: "Tom & Jerry Special Edition" },
    ])
  })

  test("matches checkboxes with reversed attribute order (name before type)", () => {
    const html = `<input name="9" type="checkbox" checked=""> <a href="#9">Reversed Attribute Order</a>`

    expect(parseDvdCompareReleasesHtml(html)).toEqual([
      { hash: "9", label: "Reversed Attribute Order" },
    ])
  })

  test("parses the unselected film page format (unquoted attrs, no <a> wrapping the label)", () => {
    // Real-world HTML from the unchecked view of a DVDCompare film page —
    // attributes are unquoted, the label sits directly after <input>, and a
    // stray closing </a> is left in the markup.
    const html = `<form action="film.php?fid=74759" method="post">
        <a href="film.php?fid=74759">Check/Show All</a><br>
        <a href="film.php?fid=74759&sel=on">Uncheck/Hide All</a><p>

        <input type=checkbox name=1> Blu-ray ALL America - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br><input type=checkbox name=2> Blu-ray ALL Canada - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br><input type=checkbox name=3> Blu-ray ALL United Kingdom - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br>
        <br>
        <input type=hidden name=sel value=on>
        <input type=submit name=submit value="Apply Filter">
      </form>`

    expect(parseDvdCompareReleasesHtml(html)).toEqual([
      {
        hash: "1",
        label:
          "Blu-ray ALL America - Arrow Films - Limited Edition [2026]",
      },
      {
        hash: "2",
        label:
          "Blu-ray ALL Canada - Arrow Films - Limited Edition [2026]",
      },
      {
        hash: "3",
        label:
          "Blu-ray ALL United Kingdom - Arrow Films - Limited Edition [2026]",
      },
    ])
  })

  test("parses real Soldier (Blu-ray 4K) page fixture (fid=74759)", () => {
    // End-to-end regression guard: the full HTML body was downloaded
    // from https://www.dvdcompare.net/comparisons/film.php?fid=74759&sel=on
    // and saved to __fixtures__. If DVDCompare changes their markup or our
    // parser regresses, this test fails immediately with the real HTML.
    const html = loadFixture(
      "dvdcompare-soldier-4k-74759.html",
    )

    expect(parseDvdCompareReleasesHtml(html)).toEqual([
      {
        hash: "1",
        label:
          "Blu-ray ALL America - Arrow Films - Limited Edition [2026]",
      },
      {
        hash: "2",
        label:
          "Blu-ray ALL Canada - Arrow Films - Limited Edition [2026]",
      },
      {
        hash: "3",
        label:
          "Blu-ray ALL United Kingdom - Arrow Films - Limited Edition [2026]",
      },
    ])
  })
})

describe(displayDvdCompareVariant.name, () => {
  test("relabels Blu-ray 4K as UHD Blu-ray", () => {
    expect(displayDvdCompareVariant("Blu-ray 4K")).toBe(
      "UHD Blu-ray",
    )
  })

  test("leaves DVD and Blu-ray untouched", () => {
    expect(displayDvdCompareVariant("DVD")).toBe("DVD")
    expect(displayDvdCompareVariant("Blu-ray")).toBe(
      "Blu-ray",
    )
  })
})

describe(parseDvdCompareFilmTitle.name, () => {
  test("returns null when no <title> tag present", () => {
    expect(
      parseDvdCompareFilmTitle("<html></html>", 100),
    ).toBeNull()
  })

  test("returns null when title has no recognizable year", () => {
    expect(
      parseDvdCompareFilmTitle(
        "<title>Some Random Page</title>",
        100,
      ),
    ).toBeNull()
  })

  test("strips a leading 'DVD Compare:' prefix and parses base+year (DVD)", () => {
    expect(
      parseDvdCompareFilmTitle(
        "<title>DVD Compare: Soldier (1998)</title>",
        12345,
      ),
    ).toEqual({
      id: 12345,
      baseTitle: "Soldier",
      variant: "DVD",
      year: "1998",
    })
  })

  test("strips a leading 'Rewind @ www.dvdcompare.net - ' prefix from newer pages", () => {
    // The current DVDCompare template renders the page <title> with the
    // "Rewind @ www.dvdcompare.net - " brand prefix instead of the older
    // "DVD Compare:" form. Both must parse cleanly.
    expect(
      parseDvdCompareFilmTitle(
        "<title>Rewind @ www.dvdcompare.net - Dragon Lord AKA Long xiao ye AKA Dragon Strike AKA Young Master in Love (Blu-ray 4K) (1982)</title>",
        74250,
      ),
    ).toEqual({
      id: 74250,
      baseTitle:
        "Dragon Lord AKA Long xiao ye AKA Dragon Strike AKA Young Master in Love",
      variant: "Blu-ray 4K",
      year: "1982",
    })
  })

  test("extracts Blu-ray variant from the title", () => {
    expect(
      parseDvdCompareFilmTitle(
        "<title>DVDCompare - Soldier (Blu-ray) (1998)</title>",
        12346,
      ),
    ).toEqual({
      id: 12346,
      baseTitle: "Soldier",
      variant: "Blu-ray",
      year: "1998",
    })
  })

  test("extracts Blu-ray 4K variant from the title", () => {
    expect(
      parseDvdCompareFilmTitle(
        "<title>DVD Compare: Soldier (Blu-ray 4K) (1998)</title>",
        12347,
      ),
    ).toEqual({
      id: 12347,
      baseTitle: "Soldier",
      variant: "Blu-ray 4K",
      year: "1998",
    })
  })

  test("decodes HTML entities and collapses whitespace inside the title", () => {
    expect(
      parseDvdCompareFilmTitle(
        "<title>DVD Compare:   Tom &amp; Jerry  (Blu-ray)  (1992)</title>",
        99,
      ),
    ).toEqual({
      id: 99,
      baseTitle: "Tom & Jerry",
      variant: "Blu-ray",
      year: "1992",
    })
  })
})

// Minimal HTML for a DVDCompare film page (the parseDvdCompareFilmTitle
// helper only needs the <title> tag).
const SOLDIER_FILM_PAGE_HTML = `<!DOCTYPE html>
<html>
<head><title>DVD Compare: Soldier (1998)</title></head>
<body><p>Film page content.</p></body>
</html>`

// Minimal HTML for a DVDCompare search results page with multiple matches.
const MULTI_RESULT_SEARCH_HTML = `<!DOCTYPE html>
<html>
<head><title>DVD Compare Search Results</title></head>
<body>
<a href="film.php?fid=1001">Soldier (1998)</a>
<a href="film.php?fid=1002">Soldier (Blu-ray) (1998)</a>
<a href="film.php?fid=1003">Soldier (Blu-ray 4K) (1998)</a>
</body>
</html>`

describe(findDvdCompareResults.name, () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    // Reset to original before each test; individual tests set their own stub.
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // Helpers to build a fake Response with a given URL (simulating a redirect).
  const makeSearchPageResponse = (
    html: string,
    finalUrl: string,
  ) => ({
    url: finalUrl,
    text: async () => html,
  })

  test("returns isDirectListing:false with all candidates when the search lands on a multi-result page", async () => {
    globalThis.fetch = vi.fn(async () =>
      makeSearchPageResponse(
        MULTI_RESULT_SEARCH_HTML,
        "https://www.dvdcompare.net/comparisons/search.php",
      ),
    ) as unknown as typeof globalThis.fetch

    const outcome = await firstValueFrom(
      findDvdCompareResults("Soldier"),
    )

    expect(outcome.isDirectListing).toBe(false)
    expect(outcome.results).toEqual([
      {
        id: 1001,
        baseTitle: "Soldier",
        variant: "DVD",
        year: "1998",
      },
      {
        id: 1002,
        baseTitle: "Soldier",
        variant: "Blu-ray",
        year: "1998",
      },
      {
        id: 1003,
        baseTitle: "Soldier",
        variant: "Blu-ray 4K",
        year: "1998",
      },
    ])
  })

  test("returns isDirectListing:true with the film's parsed details when the search redirects to a film page (e.g. 'solider')", async () => {
    // DVDCompare silently corrects 'solider' → 'Soldier' and redirects
    // straight to the film page; response.url points at film.php.
    globalThis.fetch = vi.fn(async () =>
      makeSearchPageResponse(
        SOLDIER_FILM_PAGE_HTML,
        "https://www.dvdcompare.net/comparisons/film.php?fid=12345",
      ),
    ) as unknown as typeof globalThis.fetch

    const outcome = await firstValueFrom(
      findDvdCompareResults("solider"),
    )

    expect(outcome.isDirectListing).toBe(true)
    expect(outcome.results).toEqual([
      {
        id: 12345,
        baseTitle: "Soldier",
        variant: "DVD",
        year: "1998",
      },
    ])
  })

  test("detects JS-redirect ('<script>location.href=film.php?fid=N</script>') as direct listing and fetches the film page (real 'solider' fixture)", async () => {
    // DVDCompare's POST /search.php doesn't actually issue an HTTP 302.
    // Instead, when there's a unique hit, the body is a normal 200 page
    // containing a small <script>location.href="film.php?fid=N";</script>
    // block. Node-side fetch can't execute scripts, so the previous code
    // saw a "results page with no anchors" and returned an empty list,
    // producing "No results" in the UI for inputs like 'solider'.
    //
    // After the fix, the server detects the JS-redirect marker and
    // performs a second fetch to film.php?fid=N so it can parse the
    // canonical record. Both fetches are mocked here.
    const searchPageHtml = loadFixture(
      "dvdcompare-search-solider-js-redirect.html",
    )
    const filmPageHtml = loadFixture(
      "dvdcompare-soldier-4k-74759.html",
    )
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("search.php")) {
        return Promise.resolve(
          makeSearchPageResponse(
            searchPageHtml,
            "https://www.dvdcompare.net/comparisons/search.php",
          ),
        )
      }
      // Second call lands on film.php — return the film page fixture.
      return Promise.resolve(
        makeSearchPageResponse(
          filmPageHtml,
          "https://www.dvdcompare.net/comparisons/film.php?fid=55420",
        ),
      )
    })
    globalThis.fetch =
      fetchMock as unknown as typeof globalThis.fetch

    const outcome = await firstValueFrom(
      findDvdCompareResults("solider"),
    )

    expect(outcome.isDirectListing).toBe(true)
    expect(outcome.results).toHaveLength(1)
    // The fid is extracted from the JS-redirect literal in the search HTML.
    expect(outcome.results[0].id).toBe(55420)
    // Both endpoints were called — once for search, once for the JS-redirect
    // film page — proving the JS-redirect branch fires.
    const calledUrls = fetchMock.mock.calls.map(
      (call) => call[0] as string,
    )
    expect(
      calledUrls.some((url) => url.includes("search.php")),
    ).toBe(true)
    expect(
      calledUrls.some((url) =>
        url.includes("film.php?fid=55420"),
      ),
    ).toBe(true)
  })

  test("returns isDirectListing:true with a fallback stub when the redirect film page title can't be parsed", async () => {
    // Page exists (200) but has no recognizable year in the <title>, so
    // parseDvdCompareFilmTitle returns null. We fall back to a minimal stub
    // so the caller still has the fid and can proceed.
    const unparsableHtml = `<html><head><title>Rewind @ www.dvdcompare.net - Some Untitled Page</title></head><body></body></html>`
    globalThis.fetch = vi.fn(async () =>
      makeSearchPageResponse(
        unparsableHtml,
        "https://www.dvdcompare.net/comparisons/film.php?fid=99999",
      ),
    ) as unknown as typeof globalThis.fetch

    const outcome = await firstValueFrom(
      findDvdCompareResults("anything"),
    )

    expect(outcome.isDirectListing).toBe(true)
    expect(outcome.results).toHaveLength(1)
    expect(outcome.results[0]).toMatchObject({
      id: 99999,
      variant: "DVD",
    })
  })

  test("returns isDirectListing:false with an empty results array when the search page has no film links", async () => {
    const emptyHtml = `<html><head><title>DVD Compare Search Results</title></head><body><p>No results found.</p></body></html>`
    globalThis.fetch = vi.fn(async () =>
      makeSearchPageResponse(
        emptyHtml,
        "https://www.dvdcompare.net/comparisons/search.php",
      ),
    ) as unknown as typeof globalThis.fetch

    const outcome = await firstValueFrom(
      findDvdCompareResults("xyzzy-nonexistent"),
    )

    expect(outcome.isDirectListing).toBe(false)
    expect(outcome.results).toEqual([])
  })

  test("sends the search term as the 'param' form field to search.php", async () => {
    const fetchSpy = vi.fn(async () =>
      makeSearchPageResponse(
        MULTI_RESULT_SEARCH_HTML,
        "https://www.dvdcompare.net/comparisons/search.php",
      ),
    )
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch

    await firstValueFrom(findDvdCompareResults("Soldier"))

    const [url, init] = fetchSpy.mock
      .calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(
      "https://www.dvdcompare.net/comparisons/search.php",
    )
    expect(init.method).toBe("POST")
    expect(init.body).toContain("param=Soldier")
    expect(init.body).toContain("searchtype=text")
  })
})
