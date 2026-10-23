// Fixtures under __fixtures__/vgmdb/ are RECORDED pages, trimmed to the parts
// the parsers read. VGMdb answers this project's requests with a Cloudflare
// challenge, so the pages were recorded from the Internet Archive's
// original-bytes (`id_`) copies on 2026-10-23:
//
//   search-final-fantasy.html
//     https://web.archive.org/web/20250822154617id_/https://vgmdb.net/search?q=Final+Fantasy
//     (5 of the 1069 album result rows kept)
//   album-79.html
//     https://web.archive.org/web/20251113231144id_/https://vgmdb.net/album/79
//   album-99285.html
//     https://web.archive.org/web/20250831051555id_/https://vgmdb.net/album/99285
//   album-20425.html
//     https://web.archive.org/web/20251117230058id_/https://vgmdb.net/album/20425
//
// cloudflare-challenge-403.html is the live 403 body VGMdb returned for
// https://vgmdb.net/search?q=test on 2026-10-23, with the inline challenge
// script removed.

import { join } from "node:path"

import { firstValueFrom } from "rxjs"
import { expect, test, vi } from "vitest"

import type { CachedFetch } from "./musicBrainzApi.js"
import {
  buildVgmdbSearchUrl,
  getIsVgmdbChallengePage,
  getVgmdbArtwork,
  parseVgmdbAlbumPage,
  parseVgmdbSearchResults,
  searchVgmdbArtworkCandidates,
  upgradeVgmdbImageUrl,
} from "./vgmdbArtwork.js"

// vitest.setup.ts mocks node:fs with memfs, so the real module reads the
// fixtures from disk.
const realFileSystem =
  await vi.importActual<typeof import("node:fs")>("node:fs")

const loadFixture = (fileName: string) =>
  realFileSystem.readFileSync(
    join(
      import.meta.dirname,
      "__fixtures__",
      "vgmdb",
      fileName,
    ),
    "utf8",
  )

const searchPage = loadFixture("search-final-fantasy.html")
const challengePage = loadFixture(
  "cloudflare-challenge-403.html",
)

const albumPagesById: Record<string, string> = {
  "20425": loadFixture("album-20425.html"),
  "79": loadFixture("album-79.html"),
  "99285": loadFixture("album-99285.html"),
}

const limitedEditionTitle =
  "FITHOS LUSEC WECOS VINOSEC: FINAL FANTASY VIII [Limited Edition]"

const limitedEditionCandidate = {
  albumTitle: limitedEditionTitle,
  artistNames: [
    "Nobuo Uematsu",
    "Shiro Hamaguchi",
    "Kako Someya",
    "Kazushige Nojima",
    "Koji Haijima",
    "Faye Wong",
    "Shinko Ogata",
  ],
  imageUrl:
    "https://media.vgm.io/albums/97/79/79-1264618929.png",
  pageUrl: "https://vgmdb.net/album/79",
}

// A URL-routed fetch: the search page for `/search?`, a recorded album page
// for `/album/<id>`, and a 404-style rejection for everything else.
const buildRoutedFetch = ({
  searchBody = searchPage,
}: {
  searchBody?: string
} = {}) =>
  vi.fn((url: string) =>
    url.includes("/search?")
      ? Promise.resolve({
          body: searchBody,
          isFromCache: false,
        })
      : ((albumId) =>
          albumId !== undefined && albumId in albumPagesById
            ? Promise.resolve({
                body: albumPagesById[albumId],
                isFromCache: false,
              })
            : Promise.reject(
                new Error(
                  `vgmdb request failed with status 404 for ${url}`,
                ),
              ))(url.match(/\/album\/(\d+)$/u)?.[1]),
  ) satisfies CachedFetch

test("asks for the full-size cover rather than the page's medium image", () => {
  expect(
    upgradeVgmdbImageUrl(
      "https://medium-media.vgm.io/albums/97/79/79-1264618929.png",
    ),
  ).toBe(
    "https://media.vgm.io/albums/97/79/79-1264618929.png",
  )
  expect(
    upgradeVgmdbImageUrl(
      "https://thumb-media.vgm.io/albums/97/79/79-1264618929.png",
    ),
  ).toBe(
    "https://media.vgm.io/albums/97/79/79-1264618929.png",
  )
})

test("reads every album row of a recorded search page with its titles in each language", () => {
  expect(parseVgmdbSearchResults(searchPage)).toEqual([
    {
      albumId: "99285",
      albumTitleVariants: [
        '"FINAL FANTASY X" Original Soundtrack',
        "ファイナルファンタジーX Original Soundtrack",
      ],
    },
    {
      albumId: "20425",
      albumTitleVariants: [
        '"FINAL FANTASY XIV" BATTLE TRACKS',
        "ファイナルファンタジーXIV バトル・トラックス",
      ],
    },
    {
      albumId: "20424",
      albumTitleVariants: [
        '"FINAL FANTASY XIV" FIELD TRACKS',
        "ファイナルファンタジーXIV フィールド・トラックス",
      ],
    },
    {
      albumId: "79",
      albumTitleVariants: [limitedEditionTitle],
    },
    {
      albumId: "17577",
      albumTitleVariants: [
        "Fithos Lusec Wecos Vinosec: FINAL FANTASY VIII",
      ],
    },
  ])
})

test("reads the title, the musical credits, and the full-size cover from a recorded album page", () => {
  expect(
    parseVgmdbAlbumPage(albumPagesById["79"])?.candidate,
  ).toEqual(limitedEditionCandidate)
})

test("leaves the engineers, designers, and promoters out of an album's artists", () => {
  expect(
    parseVgmdbAlbumPage(albumPagesById["79"])?.candidate
      .artistNames,
  ).not.toContain("Masaaki Kato")
})

test("drops a group named in brackets after a performer rather than calling it a second artist", () => {
  expect(
    parseVgmdbAlbumPage(albumPagesById["20425"])?.candidate
      .artistNames,
  ).toEqual(["Nobuo Uematsu", "Tsutomu Narita"])
})

test("reports no cover when the album shows VGMdb's placeholder instead of a scan", () => {
  // The recorded page with its cover swapped for the placeholder path, since
  // none of the recorded albums lacks a scan.
  const placeholderPage = albumPagesById["79"].replaceAll(
    "https://medium-media.vgm.io/albums/97/79/79-1264618929.png",
    "/db/img/album-nocover-medium.gif",
  )

  expect(
    parseVgmdbAlbumPage(placeholderPage)?.candidate
      .imageUrl,
  ).toBeNull()
})

test("does not read a search page or a challenge page as an album", () => {
  expect(parseVgmdbAlbumPage(searchPage)).toBeNull()
  expect(parseVgmdbAlbumPage(challengePage)).toBeNull()
})

test("recognizes the recorded Cloudflare challenge page", () => {
  expect(getIsVgmdbChallengePage(challengePage)).toBe(true)
  expect(
    getIsVgmdbChallengePage(albumPagesById["79"]),
  ).toBe(false)
})

test("searches on the album title alone and checks the artist against the credits", () => {
  expect(buildVgmdbSearchUrl("Battle Tracks")).toBe(
    "https://vgmdb.net/search?q=Battle+Tracks",
  )
})

test("finds the album whose title and credited artist both match", async () => {
  const cachedFetch = buildRoutedFetch()

  expect(
    await firstValueFrom(
      getVgmdbArtwork({
        albumTitle: limitedEditionTitle,
        artistName: "Nobuo Uematsu",
        cachedFetch,
      }),
    ),
  ).toEqual(limitedEditionCandidate)

  // Only the search and the one album whose title matched were requested.
  expect(
    cachedFetch.mock.calls.map(([url]) => url),
  ).toEqual([
    buildVgmdbSearchUrl(limitedEditionTitle),
    "https://vgmdb.net/album/79",
  ])
})

test("matches a title and an artist written in Japanese", async () => {
  expect(
    await firstValueFrom(
      getVgmdbArtwork({
        albumTitle:
          "ファイナルファンタジーXIV バトル・トラックス",
        artistName: "植松伸夫",
        cachedFetch: buildRoutedFetch(),
      }),
    ),
  ).toEqual({
    albumTitle: '"FINAL FANTASY XIV" BATTLE TRACKS',
    artistNames: ["Nobuo Uematsu", "Tsutomu Narita"],
    imageUrl:
      "https://media.vgm.io/albums/52/20425/20425-1285947626.jpg",
    pageUrl: "https://vgmdb.net/album/20425",
  })
})

test("accepts a title match when no artist is given", async () => {
  expect(
    (
      await firstValueFrom(
        getVgmdbArtwork({
          albumTitle:
            '"FINAL FANTASY X" Original Soundtrack',
          cachedFetch: buildRoutedFetch(),
        }),
      )
    )?.pageUrl,
  ).toBe("https://vgmdb.net/album/99285")
})

test("refuses a matching title when the artist is not credited for the music", async () => {
  expect(
    await firstValueFrom(
      getVgmdbArtwork({
        albumTitle: limitedEditionTitle,
        // Credited on this album as its mastering engineer.
        artistName: "Masaaki Kato",
        cachedFetch: buildRoutedFetch(),
      }),
    ),
  ).toBeNull()
})

test("refuses a near-miss title without opening a single album page", async () => {
  const cachedFetch = buildRoutedFetch()

  expect(
    await firstValueFrom(
      getVgmdbArtwork({
        albumTitle: "FINAL FANTASY VIII",
        artistName: "Nobuo Uematsu",
        cachedFetch,
      }),
    ),
  ).toBeNull()
  expect(cachedFetch).toHaveBeenCalledTimes(1)
})

test("refuses a title that normalizes to nothing", async () => {
  const cachedFetch = buildRoutedFetch()

  expect(
    await firstValueFrom(
      getVgmdbArtwork({
        albumTitle: "!!!",
        cachedFetch,
      }),
    ),
  ).toBeNull()
})

test("does not search when there is no album title", async () => {
  const cachedFetch = buildRoutedFetch()

  expect(
    await firstValueFrom(
      getVgmdbArtwork({ albumTitle: " ", cachedFetch }),
    ),
  ).toBeNull()
  expect(cachedFetch).not.toHaveBeenCalled()
})

test("reads a search that redirected straight to its only album", async () => {
  const cachedFetch = buildRoutedFetch({
    searchBody: albumPagesById["79"],
  })

  expect(
    await firstValueFrom(
      getVgmdbArtwork({
        albumTitle: limitedEditionTitle,
        artistName: "Faye Wong",
        cachedFetch,
      }),
    ),
  ).toEqual(limitedEditionCandidate)
  expect(cachedFetch).toHaveBeenCalledTimes(1)
})

test("a Cloudflare 403 makes VGMdb unavailable, which is no artwork rather than an error", async () => {
  const cachedFetch: CachedFetch = vi.fn(() =>
    Promise.reject(
      Object.assign(
        new Error(
          "vgmdb request failed with status 403 for https://vgmdb.net/search?q=x",
        ),
        { status: 403 },
      ),
    ),
  )

  expect(
    await firstValueFrom(
      getVgmdbArtwork({
        albumTitle: limitedEditionTitle,
        cachedFetch,
      }),
    ),
  ).toBeNull()
  expect(
    await firstValueFrom(
      searchVgmdbArtworkCandidates({
        albumTitle: limitedEditionTitle,
        cachedFetch,
      }),
    ),
  ).toEqual([])
})

test("a recorded challenge body yields no artwork even when it arrives as a response", async () => {
  const cachedFetch = buildRoutedFetch({
    searchBody: challengePage,
  })

  expect(
    await firstValueFrom(
      getVgmdbArtwork({
        albumTitle: limitedEditionTitle,
        cachedFetch,
      }),
    ),
  ).toBeNull()
  expect(
    await firstValueFrom(
      searchVgmdbArtworkCandidates({
        albumTitle: limitedEditionTitle,
        cachedFetch,
      }),
    ),
  ).toEqual([])
})

test("lists every album it could read, with the ones matching the artist first", async () => {
  const candidates = await firstValueFrom(
    searchVgmdbArtworkCandidates({
      albumTitle: limitedEditionTitle,
      artistName: "Nobuo Uematsu",
      cachedFetch: buildRoutedFetch(),
    }),
  )

  // 20424 and 17577 have no recorded page, so their requests fail and those
  // two albums are left out rather than failing the search.
  expect(
    candidates.map((candidate) => candidate.pageUrl),
  ).toEqual([
    "https://vgmdb.net/album/79",
    "https://vgmdb.net/album/99285",
    "https://vgmdb.net/album/20425",
  ])
})
