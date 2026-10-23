// Fixtures under __fixtures__/newgrounds/ are RECORDED pages, trimmed to the
// parts the parsers read. Newgrounds answers this project's requests with its
// own "NG Guard" browser check, so the pages were recorded from the Internet
// Archive's original-bytes (`id_`) copies on 2026-10-23:
//
//   search-at-the-speed-of-light.html (first result row kept)
//     https://web.archive.org/web/20240117182801id_/https://www.newgrounds.com/search/conduct/audio?terms=at+the+speed+of+light
//   search-chaoz-fantasy.html (first two result rows kept)
//     https://web.archive.org/web/20230407190727id_/https://www.newgrounds.com/search/conduct/audio?terms=Chaoz+Fantasy
//   listen-467339.html
//     https://web.archive.org/web/20251214030252id_/https://www.newgrounds.com/audio/listen/467339
//   listen-85046.html
//     https://web.archive.org/web/20260108070840id_/https://www.newgrounds.com/audio/listen/85046
//
// ng-guard-403.html is the live 403 body Newgrounds returned for
// https://www.newgrounds.com/search/conduct/audio?terms=test on 2026-10-23.

import { join } from "node:path"

import { firstValueFrom } from "rxjs"
import { expect, test, vi } from "vitest"

import type { CachedFetch } from "./musicBrainzApi.js"
import {
  buildNewgroundsSearchUrl,
  getIsNewgroundsChallengePage,
  getNewgroundsArtwork,
  parseNewgroundsListenPage,
  parseNewgroundsSearchResults,
  searchNewgroundsArtworkCandidates,
} from "./newgroundsArtwork.js"

// vitest.setup.ts mocks node:fs with memfs, so the real module reads the
// fixtures from disk.
const realFileSystem =
  await vi.importActual<typeof import("node:fs")>("node:fs")

const loadFixture = (fileName: string) =>
  realFileSystem.readFileSync(
    join(
      import.meta.dirname,
      "__fixtures__",
      "newgrounds",
      fileName,
    ),
    "utf8",
  )

const speedSearchPage = loadFixture(
  "search-at-the-speed-of-light.html",
)
const chaozSearchPage = loadFixture(
  "search-chaoz-fantasy.html",
)
const speedListenPage = loadFixture("listen-467339.html")
const chaozListenPage = loadFixture("listen-85046.html")
const guardPage = loadFixture("ng-guard-403.html")

const speedOpenGraphImage =
  '<meta property="og:image" content="https://aicon.ngfiles.com/467/467339_full.webp?f1731329744">'

const speedAuthorIconUrl =
  "https://uimg.ngfiles.com/icons/1299/1299683_large.jpg?f1634961196"

// The recorded listen page as a track with no art of its own looks. The
// `og:image` is the value an archived no-art listen page carries, Newgrounds'
// generic audio icon.
const speedListenPageWithDefaultIcon =
  speedListenPage.replace(
    speedOpenGraphImage,
    '<meta property="og:image" content="https://img.ngfiles.com/defaults/icon-audio-xl.webp?f1733938512">',
  )

const speedCandidate = {
  authorName: "Dimrain47",
  imageUrl:
    "https://aicon.ngfiles.com/467/467339_full.webp?f1731329744",
  isArtistIcon: false,
  pageUrl: "https://www.newgrounds.com/audio/listen/467339",
  title: "At the Speed of Light",
}

const chaozCandidate = {
  authorName: "ParagonX9",
  imageUrl:
    "https://aicon.ngfiles.com/85/85046.png?f1636807641",
  isArtistIcon: false,
  pageUrl: "https://www.newgrounds.com/audio/listen/85046",
  title: "ParagonX9 - Chaoz Fantasy",
}

// A URL-routed fetch: a search page for `/search/`, a recorded listen page
// for `/audio/listen/<id>`, and a 404-style rejection for everything else.
const buildRoutedFetch = ({
  listenPagesById = {
    "467339": speedListenPage,
    "85046": chaozListenPage,
  },
  searchBody,
}: {
  listenPagesById?: Record<string, string>
  searchBody: string
}) =>
  vi.fn((url: string) =>
    url.includes("/search/")
      ? Promise.resolve({
          body: searchBody,
          isFromCache: false,
        })
      : ((submissionId) =>
          submissionId !== undefined &&
          submissionId in listenPagesById
            ? Promise.resolve({
                body: listenPagesById[submissionId],
                isFromCache: false,
              })
            : Promise.reject(
                new Error(
                  `newgrounds request failed with status 404 for ${url}`,
                ),
              ))(
          url.match(/\/audio\/listen\/(\d+)$/u)?.[1],
        ),
  ) satisfies CachedFetch

test("reads the title, the author, and the submission of each recorded search row", () => {
  expect(
    parseNewgroundsSearchResults(chaozSearchPage),
  ).toEqual([
    {
      authorName: "ParagonX9",
      submissionId: "85046",
      title: "ParagonX9 - Chaoz Fantasy",
    },
    {
      authorName: "ParagonX9",
      submissionId: "486695",
      title: "Chaoz Fantasy (8-Bit)",
    },
  ])
})

test("reads the track's own art from a recorded listen page", () => {
  expect(
    parseNewgroundsListenPage({
      authorName: "Dimrain47",
      body: speedListenPage,
    }),
  ).toEqual(speedCandidate)
  expect(
    parseNewgroundsListenPage({
      authorName: "ParagonX9",
      body: chaozListenPage,
    }),
  ).toEqual(chaozCandidate)
})

test("falls back to the author's icon, flagged, when the track has only the generic audio icon", () => {
  expect(
    parseNewgroundsListenPage({
      authorName: "Dimrain47",
      body: speedListenPageWithDefaultIcon,
    }),
  ).toEqual({
    ...speedCandidate,
    imageUrl: speedAuthorIconUrl,
    isArtistIcon: true,
  })
})

test("falls back to the author's icon, flagged, when the page carries no image at all", () => {
  expect(
    parseNewgroundsListenPage({
      authorName: "Dimrain47",
      body: speedListenPage.replace(
        speedOpenGraphImage,
        "",
      ),
    })?.isArtistIcon,
  ).toBe(true)
})

test("flags an og:image that is itself a user icon", () => {
  expect(
    parseNewgroundsListenPage({
      authorName: "Dimrain47",
      body: speedListenPage.replace(
        speedOpenGraphImage,
        `<meta property="og:image" content="${speedAuthorIconUrl}">`,
      ),
    }),
  ).toEqual({
    ...speedCandidate,
    imageUrl: speedAuthorIconUrl,
    isArtistIcon: true,
  })
})

test("reports no image when there is no art and the author is not among the credited users", () => {
  expect(
    parseNewgroundsListenPage({
      authorName: "ParagonX9",
      body: speedListenPageWithDefaultIcon,
    })?.imageUrl,
  ).toBeNull()
})

test("does not read a search page or a guard page as a listen page", () => {
  expect(
    parseNewgroundsListenPage({
      authorName: "Dimrain47",
      body: speedSearchPage,
    }),
  ).toBeNull()
  expect(
    parseNewgroundsListenPage({
      authorName: "Dimrain47",
      body: guardPage,
    }),
  ).toBeNull()
})

test("recognizes the recorded NG Guard page and a Cloudflare challenge", () => {
  expect(getIsNewgroundsChallengePage(guardPage)).toBe(true)
  expect(
    getIsNewgroundsChallengePage(
      "<html><head><title>Just a moment...</title></head></html>",
    ),
  ).toBe(true)
  expect(
    getIsNewgroundsChallengePage(speedListenPage),
  ).toBe(false)
})

test("searches on the track title alone and checks the author against each result", () => {
  expect(buildNewgroundsSearchUrl("Chaoz Fantasy")).toBe(
    "https://www.newgrounds.com/search/conduct/audio?terms=Chaoz+Fantasy",
  )
})

test("finds the track whose author and title both match", async () => {
  const cachedFetch = buildRoutedFetch({
    searchBody: speedSearchPage,
  })

  expect(
    await firstValueFrom(
      getNewgroundsArtwork({
        artistName: "Dimrain47",
        cachedFetch,
        trackTitle: "At the Speed of Light",
      }),
    ),
  ).toEqual(speedCandidate)
  expect(
    cachedFetch.mock.calls.map(([url]) => url),
  ).toEqual([
    buildNewgroundsSearchUrl("At the Speed of Light"),
    "https://www.newgrounds.com/audio/listen/467339",
  ])
})

test("matches a title the uploader prefixed with their own name", async () => {
  const cachedFetch = buildRoutedFetch({
    searchBody: chaozSearchPage,
  })

  expect(
    await firstValueFrom(
      getNewgroundsArtwork({
        artistName: "ParagonX9",
        cachedFetch,
        trackTitle: "Chaoz Fantasy",
      }),
    ),
  ).toEqual(chaozCandidate)
  // The 8-Bit version's title does not match, so its page is never opened.
  expect(cachedFetch).toHaveBeenCalledTimes(2)
})

test("refuses a matching title by a different author without opening its page", async () => {
  const cachedFetch = buildRoutedFetch({
    searchBody: speedSearchPage,
  })

  expect(
    await firstValueFrom(
      getNewgroundsArtwork({
        artistName: "ParagonX9",
        cachedFetch,
        trackTitle: "At the Speed of Light",
      }),
    ),
  ).toBeNull()
  expect(cachedFetch).toHaveBeenCalledTimes(1)
})

test("refuses a near-miss title, because wrong art is worse than none", async () => {
  expect(
    await firstValueFrom(
      getNewgroundsArtwork({
        artistName: "ParagonX9",
        cachedFetch: buildRoutedFetch({
          searchBody: chaozSearchPage,
        }),
        trackTitle: "Chaoz Fantasy 8-Bit Remix",
      }),
    ),
  ).toBeNull()
})

test("returns the author's icon, flagged, when that is the only image a matching track has", async () => {
  expect(
    await firstValueFrom(
      getNewgroundsArtwork({
        artistName: "Dimrain47",
        cachedFetch: buildRoutedFetch({
          listenPagesById: {
            "467339": speedListenPageWithDefaultIcon,
          },
          searchBody: speedSearchPage,
        }),
        trackTitle: "At the Speed of Light",
      }),
    ),
  ).toEqual({
    ...speedCandidate,
    imageUrl: speedAuthorIconUrl,
    isArtistIcon: true,
  })
})

test("does not search without both an author and a title", async () => {
  const cachedFetch = buildRoutedFetch({
    searchBody: speedSearchPage,
  })

  expect(
    await firstValueFrom(
      getNewgroundsArtwork({
        artistName: "",
        cachedFetch,
        trackTitle: "At the Speed of Light",
      }),
    ),
  ).toBeNull()
  expect(
    await firstValueFrom(
      searchNewgroundsArtworkCandidates({
        artistName: "Dimrain47",
        cachedFetch,
        trackTitle: " ",
      }),
    ),
  ).toEqual([])
  expect(cachedFetch).not.toHaveBeenCalled()
})

test("a 403 makes Newgrounds unavailable, which is no artwork rather than an error", async () => {
  const cachedFetch: CachedFetch = vi.fn(() =>
    Promise.reject(
      Object.assign(
        new Error(
          "newgrounds request failed with status 403 for https://www.newgrounds.com/search/conduct/audio?terms=x",
        ),
        { status: 403 },
      ),
    ),
  )

  expect(
    await firstValueFrom(
      getNewgroundsArtwork({
        artistName: "Dimrain47",
        cachedFetch,
        trackTitle: "At the Speed of Light",
      }),
    ),
  ).toBeNull()
  expect(
    await firstValueFrom(
      searchNewgroundsArtworkCandidates({
        artistName: "Dimrain47",
        cachedFetch,
        trackTitle: "At the Speed of Light",
      }),
    ),
  ).toEqual([])
})

test("a recorded guard body yields no artwork even when it arrives as a response", async () => {
  const cachedFetch = buildRoutedFetch({
    searchBody: guardPage,
  })

  expect(
    await firstValueFrom(
      getNewgroundsArtwork({
        artistName: "Dimrain47",
        cachedFetch,
        trackTitle: "At the Speed of Light",
      }),
    ),
  ).toBeNull()
  expect(
    await firstValueFrom(
      searchNewgroundsArtworkCandidates({
        artistName: "Dimrain47",
        cachedFetch,
        trackTitle: "At the Speed of Light",
      }),
    ),
  ).toEqual([])
})

test("lists every track it could read and drops the ones whose page failed", async () => {
  // 486695 has no recorded page, so its request fails and that track is
  // left out rather than failing the search.
  expect(
    await firstValueFrom(
      searchNewgroundsArtworkCandidates({
        artistName: "ParagonX9",
        cachedFetch: buildRoutedFetch({
          searchBody: chaozSearchPage,
        }),
        trackTitle: "Chaoz Fantasy",
      }),
    ),
  ).toEqual([chaozCandidate])
})

test("puts the tracks that match the author and title ahead of the rest", async () => {
  const candidates = await firstValueFrom(
    searchNewgroundsArtworkCandidates({
      artistName: "ParagonX9",
      cachedFetch: buildRoutedFetch({
        listenPagesById: {
          // The 8-Bit row's page, stood in for by the recorded page of the
          // same author with its id and title swapped, so both rows read.
          "486695": chaozListenPage
            .replaceAll("85046", "486695")
            .replaceAll(
              "ParagonX9 - Chaoz Fantasy",
              "Chaoz Fantasy (8-Bit)",
            ),
          "85046": chaozListenPage,
        },
        searchBody: chaozSearchPage,
      }),
      trackTitle: "Chaoz Fantasy (8-Bit)",
    }),
  )

  // The search lists 85046 first; the 8-Bit track is the one asked for.
  expect(
    candidates.map((candidate) => candidate.pageUrl),
  ).toEqual([
    "https://www.newgrounds.com/audio/listen/486695",
    "https://www.newgrounds.com/audio/listen/85046",
  ])
})
