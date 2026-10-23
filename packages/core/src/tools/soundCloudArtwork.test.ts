// Fixtures recorded 2026-10-23 from SoundCloud's public oEmbed endpoint,
// `https://soundcloud.com/oembed?format=json&url=<page>`, saved verbatim:
//
// - oembed-track-with-artwork.json
//     https://soundcloud.com/porter-robinson/goodbye-to-a-world
// - oembed-playlist-without-artwork.json (the grey placeholder)
//     https://soundcloud.com/porter-robinson/sets/wannacry
// - oembed-profile-avatar.json (the uploader's avatar)
//     https://soundcloud.com/porter-robinson
import { join } from "node:path"

import { firstValueFrom } from "rxjs"
import { describe, expect, test, vi } from "vitest"

import type { CachedFetch } from "./musicBrainzApi.js"
import {
  buildSoundCloudOembedUrl,
  getComparableSoundCloudTitles,
  getIsSoundCloudPageUrl,
  getSoundCloudArtwork,
  getSoundCloudTitle,
  selectSoundCloudArtwork,
  upgradeSoundCloudArtworkUrl,
} from "./soundCloudArtwork.js"

// vitest.setup.ts mocks node:fs globally with memfs, so use vi.importActual
// to read the on-disk fixtures (same pattern as searchDvdCompare.test.ts).
const realFs =
  await vi.importActual<typeof import("node:fs")>("node:fs")

const loadFixture = (fileName: string) =>
  realFs.readFileSync(
    join(
      import.meta.dirname,
      "__fixtures__",
      "soundcloud",
      fileName,
    ),
    "utf8",
  )

const TRACK_PAGE_URL =
  "https://soundcloud.com/porter-robinson/goodbye-to-a-world"

const PLAYLIST_PAGE_URL =
  "https://soundcloud.com/porter-robinson/sets/wannacry"

const PROFILE_PAGE_URL =
  "https://soundcloud.com/porter-robinson"

const buildCachedFetch = (body: string) =>
  vi.fn<CachedFetch>(() =>
    Promise.resolve({ body, isFromCache: false }),
  )

describe(getSoundCloudArtwork.name, () => {
  test("reads the artwork, the uploader and the title from a recorded track", async () => {
    const cachedFetch = buildCachedFetch(
      loadFixture("oembed-track-with-artwork.json"),
    )

    expect(
      await firstValueFrom(
        getSoundCloudArtwork({
          cachedFetch,
          pageUrl: TRACK_PAGE_URL,
        }),
      ),
    ).toEqual({
      authorName: "Porter Robinson",
      imageUrl:
        "https://i1.sndcdn.com/artworks-1xYyJCYzaaXu-0-t500x500.jpg",
      pageUrl: TRACK_PAGE_URL,
      title: "Goodbye To A World",
    })
    expect(cachedFetch).toHaveBeenCalledWith(
      "https://soundcloud.com/oembed?format=json&url=https%3A%2F%2Fsoundcloud.com%2Fporter-robinson%2Fgoodbye-to-a-world",
    )
  })

  test("accepts a strictly matching artist and title", async () => {
    expect(
      await firstValueFrom(
        getSoundCloudArtwork({
          artistName: "porter robinson",
          cachedFetch: buildCachedFetch(
            loadFixture("oembed-track-with-artwork.json"),
          ),
          pageUrl: TRACK_PAGE_URL,
          trackTitle: "Goodbye to a World!",
        }),
      ),
    ).toMatchObject({ title: "Goodbye To A World" })
  })

  test("refuses a page whose title is not the expected song", async () => {
    expect(
      await firstValueFrom(
        getSoundCloudArtwork({
          artistName: "Porter Robinson",
          cachedFetch: buildCachedFetch(
            loadFixture("oembed-track-with-artwork.json"),
          ),
          pageUrl: TRACK_PAGE_URL,
          trackTitle: "Goodbye To A World (Live)",
        }),
      ),
    ).toBeNull()
  })

  test("refuses a page by a different uploader", async () => {
    expect(
      await firstValueFrom(
        getSoundCloudArtwork({
          artistName: "Madeon",
          cachedFetch: buildCachedFetch(
            loadFixture("oembed-track-with-artwork.json"),
          ),
          pageUrl: TRACK_PAGE_URL,
        }),
      ),
    ).toBeNull()
  })

  test("returns null for the grey placeholder a page without artwork gets", async () => {
    expect(
      await firstValueFrom(
        getSoundCloudArtwork({
          cachedFetch: buildCachedFetch(
            loadFixture(
              "oembed-playlist-without-artwork.json",
            ),
          ),
          pageUrl: PLAYLIST_PAGE_URL,
        }),
      ),
    ).toBeNull()
  })

  test("returns null for the uploader's avatar, because a photo of the uploader is not cover art", async () => {
    expect(
      await firstValueFrom(
        getSoundCloudArtwork({
          cachedFetch: buildCachedFetch(
            loadFixture("oembed-profile-avatar.json"),
          ),
          pageUrl: PROFILE_PAGE_URL,
        }),
      ),
    ).toBeNull()
  })

  test("returns null when the request fails, as a removed track's 404 does", async () => {
    const cachedFetch = vi.fn<CachedFetch>(() =>
      Promise.reject(
        new Error(
          "soundCloud request failed with status 404",
        ),
      ),
    )

    expect(
      await firstValueFrom(
        getSoundCloudArtwork({
          cachedFetch,
          pageUrl: TRACK_PAGE_URL,
        }),
      ),
    ).toBeNull()
  })

  test("returns null for a body that is not JSON", async () => {
    expect(
      await firstValueFrom(
        getSoundCloudArtwork({
          cachedFetch: buildCachedFetch("<html></html>"),
          pageUrl: TRACK_PAGE_URL,
        }),
      ),
    ).toBeNull()
  })

  test("sends nothing for a URL that is not a SoundCloud page", async () => {
    const cachedFetch = buildCachedFetch(
      loadFixture("oembed-track-with-artwork.json"),
    )

    expect(
      await firstValueFrom(
        getSoundCloudArtwork({
          cachedFetch,
          pageUrl: "https://example.com/porter-robinson",
        }),
      ),
    ).toBeNull()
    expect(cachedFetch).not.toHaveBeenCalled()
  })
})

describe(selectSoundCloudArtwork.name, () => {
  const buildResponse = (title: string) => ({
    author_name: "Porter Robinson",
    thumbnail_url:
      "https://i1.sndcdn.com/artworks-abc123-0-t500x500.jpg",
    title: `${title} by Porter Robinson`,
  })

  test("accepts a title written as '<uploader> - <title>'", () => {
    expect(
      selectSoundCloudArtwork({
        artistName: "Porter Robinson",
        pageUrl: TRACK_PAGE_URL,
        rawResponse: buildResponse(
          "Porter Robinson - Goodbye To A World",
        ),
        trackTitle: "Goodbye To A World",
      }),
    ).toEqual({
      authorName: "Porter Robinson",
      imageUrl:
        "https://i1.sndcdn.com/artworks-abc123-0-t500x500.jpg",
      pageUrl: TRACK_PAGE_URL,
      title: "Porter Robinson - Goodbye To A World",
    })
  })

  test("refuses an expected title that normalises to nothing", () => {
    expect(
      selectSoundCloudArtwork({
        pageUrl: TRACK_PAGE_URL,
        rawResponse: buildResponse("さよなら"),
        trackTitle: "さよなら",
      }),
    ).toBeNull()
  })

  test("refuses an expected artist that normalises to nothing", () => {
    expect(
      selectSoundCloudArtwork({
        artistName: "",
        pageUrl: TRACK_PAGE_URL,
        rawResponse: buildResponse("Goodbye To A World"),
      }),
    ).toBeNull()
  })

  test("refuses a response with no thumbnail", () => {
    expect(
      selectSoundCloudArtwork({
        pageUrl: TRACK_PAGE_URL,
        rawResponse: {
          author_name: "Porter Robinson",
          title: "Goodbye To A World by Porter Robinson",
        },
      }),
    ).toBeNull()
  })
})

describe(getComparableSoundCloudTitles.name, () => {
  test("offers the part after a leading '<uploader> - '", () => {
    expect(
      getComparableSoundCloudTitles({
        authorName: "Porter Robinson",
        title: "porter robinson – Language",
      }),
    ).toEqual(["porter robinson – Language", "Language"])
  })

  test("keeps the whole title when the prefix is somebody else", () => {
    expect(
      getComparableSoundCloudTitles({
        authorName: "Porter Robinson",
        title: "Madeon - Shelter",
      }),
    ).toEqual(["Madeon - Shelter"])
  })
})

describe(getSoundCloudTitle.name, () => {
  test("takes the uploader off the end of oEmbed's title", () => {
    expect(
      getSoundCloudTitle({
        authorName: "Porter Robinson",
        oembedTitle:
          "Goodbye To A World by Porter Robinson",
      }),
    ).toBe("Goodbye To A World")
  })

  test("leaves a title that does not end with the uploader alone", () => {
    expect(
      getSoundCloudTitle({
        authorName: "Porter Robinson",
        oembedTitle: "Stand By Me",
      }),
    ).toBe("Stand By Me")
  })
})

describe(upgradeSoundCloudArtworkUrl.name, () => {
  test("moves the 100 pixel 'large' size to t500x500", () => {
    expect(
      upgradeSoundCloudArtworkUrl(
        "https://i1.sndcdn.com/artworks-abc123-0-large.jpg",
      ),
    ).toBe(
      "https://i1.sndcdn.com/artworks-abc123-0-t500x500.jpg",
    )
  })

  test("moves an original of either extension to t500x500.jpg", () => {
    expect(
      upgradeSoundCloudArtworkUrl(
        "https://i1.sndcdn.com/artworks-abc123-0-original.png",
      ),
    ).toBe(
      "https://i1.sndcdn.com/artworks-abc123-0-t500x500.jpg",
    )
  })

  test("leaves a t500x500 URL as it is", () => {
    expect(
      upgradeSoundCloudArtworkUrl(
        "https://i1.sndcdn.com/artworks-abc123-0-t500x500.jpg",
      ),
    ).toBe(
      "https://i1.sndcdn.com/artworks-abc123-0-t500x500.jpg",
    )
  })
})

describe(getIsSoundCloudPageUrl.name, () => {
  test("accepts a SoundCloud page and refuses anything else", () => {
    expect([
      getIsSoundCloudPageUrl(TRACK_PAGE_URL),
      getIsSoundCloudPageUrl(
        "https://m.soundcloud.com/porter-robinson",
      ),
      getIsSoundCloudPageUrl(
        "http://soundcloud.com/porter-robinson",
      ),
      getIsSoundCloudPageUrl(
        "https://soundcloud.com.example.com/a",
      ),
      getIsSoundCloudPageUrl("not a url"),
    ]).toEqual([true, true, false, false, false])
  })
})

test("builds the oEmbed request with the page URL encoded", () => {
  expect(buildSoundCloudOembedUrl(PLAYLIST_PAGE_URL)).toBe(
    "https://soundcloud.com/oembed?format=json&url=https%3A%2F%2Fsoundcloud.com%2Fporter-robinson%2Fsets%2Fwannacry",
  )
})
