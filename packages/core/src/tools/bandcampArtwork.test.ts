// Fixtures recorded 2026-10-23 from Bandcamp's public artist pages, trimmed
// to the parts the parser reads (the Open Graph tags, the discography grid,
// and the fields of `data-tralbum` named in `BandcampTralbum`):
//   https://carpenterbrut.bandcamp.com/robots.txt
//   https://carpenterbrut.bandcamp.com/music
//   https://carpenterbrut.bandcamp.com/album/ep-i
//   https://carpenterbrut.bandcamp.com/track/maniac-feat-yann-ligner
//   https://c418.bandcamp.com/music
import { firstValueFrom } from "rxjs"
import { expect, test, vi } from "vitest"

import {
  buildBandcampImageUrlFromArtId,
  getBandcampArtwork,
  listBandcampArtistReleases,
  upgradeBandcampImageUrl,
} from "./bandcampArtwork.js"
import type { CachedFetch } from "./musicBrainzApi.js"

// vitest.setup.ts mocks node:fs with memfs, so the committed fixtures are
// read through the real module.
const realFileSystem =
  await vi.importActual<typeof import("node:fs")>("node:fs")
const realPath =
  await vi.importActual<typeof import("node:path")>(
    "node:path",
  )

const readFixture = (fileName: string) =>
  realFileSystem.readFileSync(
    realPath.join(
      __dirname,
      "__fixtures__",
      "bandcamp",
      fileName,
    ),
    "utf8",
  )

const ROBOTS = readFixture("carpenterbrut-robots.txt")
const CARPENTER_BRUT_MUSIC = readFixture(
  "carpenterbrut-music.html",
)
const CARPENTER_BRUT_ALBUM = readFixture(
  "carpenterbrut-album-ep-i.html",
)
const CARPENTER_BRUT_TRACK = readFixture(
  "carpenterbrut-track-maniac-feat-yann-ligner.html",
)
const C418_MUSIC = readFixture("c418-music.html")

const CARPENTER_BRUT = "https://carpenterbrut.bandcamp.com"

const buildCachedFetch = (pages: Record<string, string>) =>
  vi.fn<CachedFetch>((url) =>
    url in pages
      ? Promise.resolve({
          body: pages[url],
          isFromCache: false,
        })
      : Promise.reject(
          Object.assign(
            new Error(
              `request failed with status 404 for ${url}`,
            ),
            { status: 404 },
          ),
        ),
  )

const EP_I = {
  artistName: "Carpenter Brut",
  imageUrl: "https://f4.bcbits.com/img/a2304079740_0.jpg",
  itemKind: "album",
  pageUrl: `${CARPENTER_BRUT}/album/ep-i`,
  title: "EP I",
}

test("asks for the original upload rather than a thumbnail size", () => {
  expect(
    upgradeBandcampImageUrl(
      "https://f4.bcbits.com/img/a2304079740_2.jpg",
    ),
  ).toBe("https://f4.bcbits.com/img/a2304079740_0.jpg")
  expect(
    upgradeBandcampImageUrl(
      "https://f4.bcbits.com/img/a3944930951_5.jpg",
    ),
  ).toBe("https://f4.bcbits.com/img/a3944930951_0.jpg")
})

test("builds the image URL from an art id padded to ten digits", () => {
  expect(buildBandcampImageUrlFromArtId(265938150)).toBe(
    "https://f4.bcbits.com/img/a0265938150_0.jpg",
  )
  expect(buildBandcampImageUrlFromArtId(null)).toBe("")
})

test("lists every album and single on the discography grid", async () => {
  const releases = await firstValueFrom(
    listBandcampArtistReleases({
      artistPageUrl: `${CARPENTER_BRUT}/`,
      cachedFetch: buildCachedFetch({
        [`${CARPENTER_BRUT}/music`]: CARPENTER_BRUT_MUSIC,
        [`${CARPENTER_BRUT}/robots.txt`]: ROBOTS,
      }),
    }),
  )

  expect(releases.map((release) => release.title)).toEqual([
    "LEATHER TEMPLE",
    "Death Racer (The Crew Motorfest Official Soundtrack)",
    "LEATHER TERROR",
    "FAB TOOL feat. David Eugene Edwards",
    "MANIAC feat Yann Ligner",
    "BLOOD MACHINES OST",
    "LEATHER TEETH",
    "CARPENTERBRUTLIVE",
    "TRILOGY",
    "EP III",
    "EP II",
    "EP I",
  ])
  expect(releases.at(4)).toEqual({
    artistName: "Carpenter Brut",
    imageUrl: "https://f4.bcbits.com/img/a3944930951_0.jpg",
    itemKind: "track",
    pageUrl: `${CARPENTER_BRUT}/track/maniac-feat-yann-ligner`,
    title: "MANIAC feat Yann Ligner",
  })
  // A lazily loaded thumbnail: the image is in `data-original`.
  expect(releases.at(-1)).toEqual(EP_I)
})

test("reads the grid's JSON items and an artist credited per release", async () => {
  const releases = await firstValueFrom(
    listBandcampArtistReleases({
      artistPageUrl: "https://c418.bandcamp.com",
      cachedFetch: buildCachedFetch({
        "https://c418.bandcamp.com/music": C418_MUSIC,
        "https://c418.bandcamp.com/robots.txt": ROBOTS,
      }),
    }),
  )

  expect(releases).toHaveLength(25)
  expect(
    releases.find(
      (release) =>
        release.title ===
        "The Driver - Savlonic (C418 Remix)",
    ),
  ).toEqual({
    artistName: "Savlonic, C418",
    imageUrl: "https://f4.bcbits.com/img/a2069064269_0.jpg",
    itemKind: "album",
    pageUrl:
      "https://c418.bandcamp.com/album/the-driver-savlonic-c418-remix",
    title: "The Driver - Savlonic (C418 Remix)",
  })
  expect(
    releases.find(
      (release) =>
        release.title ===
        "Catacomb Snatch Original Soundtrack",
    ),
  ).toEqual({
    artistName: "anosou, C418",
    imageUrl: "https://f4.bcbits.com/img/a2317982457_0.jpg",
    itemKind: "album",
    pageUrl:
      "https://c418.bandcamp.com/album/catacomb-snatch-original-soundtrack",
    title: "Catacomb Snatch Original Soundtrack",
  })
})

test("falls back to the artist root when the music page fails", async () => {
  const releases = await firstValueFrom(
    listBandcampArtistReleases({
      artistPageUrl: CARPENTER_BRUT,
      cachedFetch: buildCachedFetch({
        [`${CARPENTER_BRUT}/`]: CARPENTER_BRUT_MUSIC,
        [`${CARPENTER_BRUT}/robots.txt`]: ROBOTS,
      }),
    }),
  )

  expect(releases).toHaveLength(12)
})

test("reads a one-release artist from the release page the music page redirects to", async () => {
  // `fetch` follows Bandcamp's redirect, so the body of /music IS the
  // album page.
  const cachedFetch = buildCachedFetch({
    [`${CARPENTER_BRUT}/music`]: CARPENTER_BRUT_ALBUM,
    [`${CARPENTER_BRUT}/robots.txt`]: ROBOTS,
  })

  expect(
    await firstValueFrom(
      listBandcampArtistReleases({
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch,
      }),
    ),
  ).toEqual([EP_I])

  expect(
    await firstValueFrom(
      getBandcampArtwork({
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch,
        trackTitle: "Le Perv",
      }),
    ),
  ).toEqual(EP_I)
  // Two requests per call — robots.txt and /music — and no album page,
  // because the redirected page already carried the track list.
  expect(cachedFetch).toHaveBeenCalledTimes(4)
})

test("reads a single track page the same way", async () => {
  expect(
    await firstValueFrom(
      listBandcampArtistReleases({
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch: buildCachedFetch({
          [`${CARPENTER_BRUT}/music`]: CARPENTER_BRUT_TRACK,
          [`${CARPENTER_BRUT}/robots.txt`]: ROBOTS,
        }),
      }),
    ),
  ).toEqual([
    {
      artistName: "Carpenter Brut",
      imageUrl:
        "https://f4.bcbits.com/img/a3944930951_0.jpg",
      itemKind: "track",
      pageUrl: `${CARPENTER_BRUT}/track/maniac-feat-yann-ligner`,
      title: "MANIAC feat Yann Ligner",
    },
  ])
})

test("reads no page that robots.txt disallows", async () => {
  const cachedFetch = buildCachedFetch({
    [`${CARPENTER_BRUT}/music`]: CARPENTER_BRUT_MUSIC,
    [`${CARPENTER_BRUT}/robots.txt`]:
      "User-agent: *\nDisallow: /",
  })

  expect(
    await firstValueFrom(
      getBandcampArtwork({
        albumTitle: "EP I",
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch,
      }),
    ),
  ).toBeNull()
  expect(
    cachedFetch.mock.calls.map(([url]) => url),
  ).toEqual([`${CARPENTER_BRUT}/robots.txt`])
})

test("reads nothing when robots.txt cannot be read", async () => {
  const cachedFetch = vi.fn<CachedFetch>(() =>
    Promise.reject(
      Object.assign(new Error("status 503"), {
        status: 503,
      }),
    ),
  )

  expect(
    await firstValueFrom(
      listBandcampArtistReleases({
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch,
      }),
    ),
  ).toEqual([])
  expect(cachedFetch).toHaveBeenCalledTimes(1)
})

test("treats a missing robots.txt as no restriction", async () => {
  expect(
    await firstValueFrom(
      getBandcampArtwork({
        albumTitle: "EP I",
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch: buildCachedFetch({
          [`${CARPENTER_BRUT}/music`]: CARPENTER_BRUT_MUSIC,
        }),
      }),
    ),
  ).toEqual(EP_I)
})

test("accepts an album whose title is equal once case and punctuation are gone", async () => {
  expect(
    await firstValueFrom(
      getBandcampArtwork({
        albumTitle: "ep i",
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch: buildCachedFetch({
          [`${CARPENTER_BRUT}/music`]: CARPENTER_BRUT_MUSIC,
          [`${CARPENTER_BRUT}/robots.txt`]: ROBOTS,
        }),
      }),
    ),
  ).toEqual(EP_I)
})

test("accepts a single whose title matches the track title", async () => {
  expect(
    await firstValueFrom(
      getBandcampArtwork({
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch: buildCachedFetch({
          [`${CARPENTER_BRUT}/music`]: CARPENTER_BRUT_MUSIC,
          [`${CARPENTER_BRUT}/robots.txt`]: ROBOTS,
        }),
        trackTitle: "Maniac (feat. Yann Ligner)",
      }),
    ),
  ).toEqual({
    artistName: "Carpenter Brut",
    imageUrl: "https://f4.bcbits.com/img/a3944930951_0.jpg",
    itemKind: "track",
    pageUrl: `${CARPENTER_BRUT}/track/maniac-feat-yann-ligner`,
    title: "MANIAC feat Yann Ligner",
  })
})

test("finds a track inside an album and returns that album's cover", async () => {
  const cachedFetch = buildCachedFetch({
    [`${CARPENTER_BRUT}/album/ep-i`]: CARPENTER_BRUT_ALBUM,
    [`${CARPENTER_BRUT}/music`]: CARPENTER_BRUT_MUSIC,
    [`${CARPENTER_BRUT}/robots.txt`]: ROBOTS,
  })

  expect(
    await firstValueFrom(
      getBandcampArtwork({
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch,
        trackTitle: "Disco Zombi Italia",
      }),
    ),
  ).toEqual(EP_I)
  // EP I is the ninth album on the grid; the eight before it fail here
  // (no fixture) and are skipped rather than ending the lookup.
  expect(
    cachedFetch.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes("/album/")),
  ).toHaveLength(9)
})

test("refuses a near-miss title, because a wrong cover is worse than none", async () => {
  const cachedFetch = buildCachedFetch({
    [`${CARPENTER_BRUT}/album/ep-i`]: CARPENTER_BRUT_ALBUM,
    [`${CARPENTER_BRUT}/music`]: CARPENTER_BRUT_MUSIC,
    [`${CARPENTER_BRUT}/robots.txt`]: ROBOTS,
  })

  expect(
    await firstValueFrom(
      getBandcampArtwork({
        albumTitle: "EP I (Remastered)",
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch,
      }),
    ),
  ).toBeNull()
  expect(
    await firstValueFrom(
      getBandcampArtwork({
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch,
        trackTitle: "Disco Zombi",
      }),
    ),
  ).toBeNull()
})

test("refuses a title that normalises to nothing, and asks for nothing", async () => {
  const cachedFetch = buildCachedFetch({
    [`${CARPENTER_BRUT}/music`]: CARPENTER_BRUT_MUSIC,
    [`${CARPENTER_BRUT}/robots.txt`]: ROBOTS,
  })

  expect(
    await firstValueFrom(
      getBandcampArtwork({
        albumTitle: "!!!",
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch,
        trackTitle: " - ",
      }),
    ),
  ).toBeNull()
  expect(cachedFetch).not.toHaveBeenCalled()
})

test("returns null rather than throwing when every request fails", async () => {
  const cachedFetch = vi.fn<CachedFetch>(() =>
    Promise.reject(new Error("network down")),
  )

  expect(
    await firstValueFrom(
      getBandcampArtwork({
        albumTitle: "EP I",
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch,
      }),
    ),
  ).toBeNull()
  expect(
    await firstValueFrom(
      getBandcampArtwork({
        albumTitle: "EP I",
        artistPageUrl: "not a url",
        cachedFetch,
      }),
    ),
  ).toBeNull()
})

test("returns null for a 403 on the artist's pages", async () => {
  const cachedFetch = vi.fn<CachedFetch>((url) =>
    url.endsWith("/robots.txt")
      ? Promise.resolve({
          body: ROBOTS,
          isFromCache: false,
        })
      : Promise.reject(
          Object.assign(new Error("status 403"), {
            status: 403,
          }),
        ),
  )

  expect(
    await firstValueFrom(
      getBandcampArtwork({
        albumTitle: "EP I",
        artistPageUrl: CARPENTER_BRUT,
        cachedFetch,
      }),
    ),
  ).toBeNull()
})
