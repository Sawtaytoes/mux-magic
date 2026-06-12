import { firstValueFrom } from "rxjs"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  getReleaseHashesByDvdCompareId,
  parseDvdCompareReleasesHtml,
} from "./searchDvdCompare.js"

// ─── HTML fixtures ────────────────────────────────────────────────────────────

const SINGLE_RELEASE_HTML = `<html><body>
  <form action="film.php?fid=123" method="post">
    <input type=checkbox name=1> Blu-ray ALL America - Some Distributor <span class="disc-release-year">[2023]</span></a><br>
    <input type=hidden name=sel value=on>
    <input type=submit name=submit value="Apply Filter">
  </form>
</body></html>`

const MULTI_RELEASE_HTML = `<html><body>
  <form action="film.php?fid=456" method="post">
    <input type=checkbox name=1> Blu-ray ALL America - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br>
    <input type=checkbox name=2> Blu-ray ALL Canada - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br>
    <input type=checkbox name=3> Blu-ray ALL United Kingdom - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br>
    <input type=hidden name=sel value=on>
    <input type=submit name=submit value="Apply Filter">
  </form>
</body></html>`

const ZERO_RELEASE_HTML = `<html><body>
  <form action="film.php?fid=789" method="post">
    <input type=hidden name=sel value=on>
    <input type=submit name=submit value="Apply Filter">
  </form>
</body></html>`

// ─── parseDvdCompareReleasesHtml is already tested in searchDvdCompare.test.ts ──
// These tests document the shapes expected by getReleaseHashesByDvdCompareId.

describe("parseDvdCompareReleasesHtml — fixture shapes", () => {
  test("parses a single-release page", () => {
    expect(
      parseDvdCompareReleasesHtml(SINGLE_RELEASE_HTML),
    ).toEqual([
      {
        hash: "1",
        label:
          "Blu-ray ALL America - Some Distributor [2023]",
      },
    ])
  })

  test("parses a multi-release page", () => {
    expect(
      parseDvdCompareReleasesHtml(MULTI_RELEASE_HTML),
    ).toEqual([
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

  test("parses a zero-release page to an empty array", () => {
    expect(
      parseDvdCompareReleasesHtml(ZERO_RELEASE_HTML),
    ).toEqual([])
  })
})

// ─── getReleaseHashesByDvdCompareId ──────────────────────────────────────────

describe(getReleaseHashesByDvdCompareId.name, () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const makeFetchStub = (html: string) => {
    globalThis.fetch = vi.fn(async () => ({
      status: 200,
      text: async () => html,
    })) as unknown as typeof globalThis.fetch
  }

  test("fetches film.php?fid=<id>&sel=on and returns parsed releases", async () => {
    const fetchSpy = vi.fn(async () => ({
      status: 200,
      text: async () => MULTI_RELEASE_HTML,
    }))
    globalThis.fetch =
      fetchSpy as unknown as typeof globalThis.fetch

    const releases = await firstValueFrom(
      getReleaseHashesByDvdCompareId(456),
    )

    expect(releases).toEqual([
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

    const firstCallArgs = fetchSpy.mock
      .calls[0] as unknown as [string]
    const calledUrl = firstCallArgs[0]
    expect(calledUrl).toContain("film.php?fid=456")
    expect(calledUrl).toContain("sel=on")
  })

  test("returns a single-item array when the page has exactly one release", async () => {
    makeFetchStub(SINGLE_RELEASE_HTML)

    const releases = await firstValueFrom(
      getReleaseHashesByDvdCompareId(123),
    )

    expect(releases).toHaveLength(1)
    expect(releases[0]).toEqual({
      hash: "1",
      label:
        "Blu-ray ALL America - Some Distributor [2023]",
    })
  })

  test("returns an empty array when the page has no releases", async () => {
    makeFetchStub(ZERO_RELEASE_HTML)

    const releases = await firstValueFrom(
      getReleaseHashesByDvdCompareId(789),
    )

    expect(releases).toEqual([])
  })
})
