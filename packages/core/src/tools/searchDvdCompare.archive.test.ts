import { firstValueFrom } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

const launchBrowserMock = vi.hoisted(() => vi.fn())

vi.mock("./launchBrowser.js", () => ({
  BROWSER_USER_AGENT: "Mozilla/5.0 test",
  gotoPage: vi.fn(),
  launchBrowser: launchBrowserMock,
  newPageWithUserAgent: vi.fn(),
  performAndWaitForNavigation: vi.fn(),
}))

import { openProviderCache } from "../provider-cache/providerCache.js"
import { createDvdCompareScrapeCache } from "./dvdCompareFetcher.js"
import {
  parseArchivedDvdCompareRelease,
  searchDvdCompare,
} from "./searchDvdCompare.js"

const DVD_COMPARE_URL =
  "https://www.dvdcompare.net/comparisons/film.php?fid=12345#2"

const ARCHIVED_HTML = `<!doctype html>
<html>
  <head><title>DVD Compare: Archive Test (Blu-ray) (1998)</title></head>
  <body>
    <table>
      <tr>
        <td>
          <ul class="dvd">
            <li><div class="description"><h3><a name="1">First release</a></h3></div></li>
            <li><div class="label">Extras:</div><div class="description">Wrong extra (1:00)</div></li>
          </ul>
        </td>
      </tr>
      <tr>
        <td>
          <ul class="dvd">
            <li><div class="description"><h3><a name="2">Selected release</a></h3></div></li>
            <li><div class="label">Extras:</div><div class="description">First extra (2:19)<br>Second extra (Play All - 97:30)</div></li>
            <li><div class="label">Extras:</div><div class="description">Disc two extra (3:04)</div></li>
          </ul>
        </td>
      </tr>
    </table>
  </body>
</html>`

describe(parseArchivedDvdCompareRelease.name, () => {
  test("selects one release package and keeps line breaks across discs", () => {
    expect(
      parseArchivedDvdCompareRelease({
        html: ARCHIVED_HTML,
        url: DVD_COMPARE_URL,
      }),
    ).toEqual({
      extras:
        "First extra (2:19)\nSecond extra (Play All - 97:30)\n\nDisc two extra (3:04)",
      filmTitle: {
        baseTitle: "Archive Test",
        id: 12345,
        variant: "Blu-ray",
        year: "1998",
      },
    })
  })
})

describe("searchDvdCompare archive fallback", () => {
  beforeEach(() => {
    launchBrowserMock.mockReset()
    launchBrowserMock.mockRejectedValue(
      new Error(
        "page.goto: net::ERR_CONNECTION_TIMED_OUT at https://www.dvdcompare.net",
      ),
    )
  })

  test("caches the archived release scrape after the live site fails", async () => {
    const cacheScrape = createDvdCompareScrapeCache({
      cache: openProviderCache({
        databasePath: ":memory:",
      }),
    })
    const fetchArchivedPage = vi.fn(async () => ({
      html: ARCHIVED_HTML,
      status: 200,
      url: DVD_COMPARE_URL,
    }))

    const first = await firstValueFrom(
      searchDvdCompare({
        cacheScrape,
        fetchArchivedPage,
        url: DVD_COMPARE_URL,
      }),
    )
    const second = await firstValueFrom(
      searchDvdCompare({
        cacheScrape,
        fetchArchivedPage,
        url: DVD_COMPARE_URL,
      }),
    )

    expect(second).toEqual(first)
    expect(launchBrowserMock).toHaveBeenCalledOnce()
    expect(fetchArchivedPage).toHaveBeenCalledOnce()
  })
})
