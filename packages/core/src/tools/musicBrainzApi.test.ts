import { captureConsoleMessage } from "@mux-magic/tools/test-helpers"
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
  buildReleaseSearchQuery,
  type CachedFetch,
  convertPunctuation,
  DEFAULT_EXCLUDED_GENRES,
  deriveIsMultiArtist,
  getMusicBrainzRelease,
  joinArtistCredit,
  MAXIMUM_GENRE_COUNT,
  MINIMUM_GENRE_USAGE_PERCENT,
  MUSICBRAINZ_QUERY_LIMIT,
  type MusicBrainzRawRelease,
  mapMusicBrainzRelease,
  requireMusicBrainzUserAgent,
  searchMusicBrainzReleases,
  selectGenres,
  selectLocaleAlias,
} from "./musicBrainzApi.js"

const createStubCachedFetch = (bodyByUrl: string) => {
  const stub = vi.fn(async (_url: string) => ({
    body: bodyByUrl,
    isFromCache: true,
  }))
  return stub as unknown as CachedFetch & typeof stub
}

const singleArtistRelease: MusicBrainzRawRelease = {
  id: "release-1",
  title: "Kind of Blue",
  date: "1959-08-17",
  country: "US",
  barcode: "074646493526",
  "track-count": 2,
  score: 100,
  "artist-credit": [
    {
      name: "Miles Davis Quintet",
      joinphrase: "",
      artist: {
        id: "artist-1",
        name: "Miles Davis",
        aliases: [
          {
            name: "マイルス・デイヴィス",
            locale: "ja",
            primary: true,
          },
          {
            name: "Miles Dewey Davis III",
            locale: "en",
            primary: true,
          },
        ],
      },
    },
  ],
  "release-group": {
    id: "group-1",
    "primary-type": "Album",
    "secondary-types": [],
  },
  "label-info": [
    { label: { id: "label-1", name: "Columbia" } },
  ],
  media: [
    {
      position: 1,
      format: "CD",
      "track-count": 2,
      tracks: [
        {
          position: 1,
          title: "So What",
          length: 545_000,
          recording: { id: "recording-1" },
        },
        {
          position: 2,
          title: "Freddie Freeloader",
          length: 586_000,
          recording: { id: "recording-2" },
        },
      ],
    },
  ],
  genres: [{ name: "jazz", count: 10 }],
  tags: [{ name: "owned", count: 10 }],
}

const variousArtistsRelease: MusicBrainzRawRelease = {
  id: "release-2",
  title: "Now That's What I Call Music",
  "artist-credit": [
    {
      name: "Various Artists",
      artist: { id: "va", name: "Various Artists" },
    },
  ],
  media: [
    {
      position: 1,
      format: "CD",
      tracks: [
        {
          position: 1,
          title: "First",
          length: 200_000,
          recording: { id: "recording-a" },
          "artist-credit": [
            {
              name: "Artist A",
              artist: { id: "artist-a", name: "Artist A" },
            },
          ],
        },
        {
          position: 2,
          title: "Second",
          length: 210_000,
          recording: { id: "recording-b" },
          "artist-credit": [
            {
              name: "Artist B",
              artist: { id: "artist-b", name: "Artist B" },
            },
          ],
        },
      ],
    },
  ],
}

describe(mapMusicBrainzRelease.name, () => {
  test("maps the release, its media and its tracks onto the local shape", () => {
    const release = mapMusicBrainzRelease({
      rawRelease: singleArtistRelease,
    })
    expect(release.releaseId).toBe("release-1")
    expect(release.title).toBe("Kind of Blue")
    expect(release.artistId).toBe("artist-1")
    expect(release.releaseGroupId).toBe("group-1")
    expect(release.date).toBe("1959-08-17")
    expect(release.country).toBe("US")
    expect(release.formats).toEqual(["CD"])
    expect(release.labels).toEqual(["Columbia"])
    expect(release.barcode).toBe("074646493526")
    expect(release.trackCount).toBe(2)
    expect(release.primaryType).toBe("Album")
    expect(release.media).toEqual([
      {
        discNumber: 1,
        format: "CD",
        trackCount: 2,
        tracks: [
          {
            artistCredit: [
              {
                artistId: "artist-1",
                joinPhrase: "",
                name: "Miles Dewey Davis III",
              },
            ],
            lengthMilliseconds: 545_000,
            position: 1,
            recordingId: "recording-1",
            title: "So What",
          },
          {
            artistCredit: [
              {
                artistId: "artist-1",
                joinPhrase: "",
                name: "Miles Dewey Davis III",
              },
            ],
            lengthMilliseconds: 586_000,
            position: 2,
            recordingId: "recording-2",
            title: "Freddie Freeloader",
          },
        ],
      },
    ])
  })

  test("derives isMultiArtist false for a single-artist album", () => {
    expect(
      mapMusicBrainzRelease({
        rawRelease: singleArtistRelease,
      }).isMultiArtist,
    ).toBe(false)
  })

  test("derives isMultiArtist true for a various-artists compilation", () => {
    expect(
      mapMusicBrainzRelease({
        rawRelease: variousArtistsRelease,
      }).isMultiArtist,
    ).toBe(true)
  })

  test("standardize_artists=true prefers the artist's own name over the credited-as name", () => {
    expect(
      mapMusicBrainzRelease({
        isArtistNameTranslated: false,
        rawRelease: singleArtistRelease,
      }).artistCredit[0].name,
    ).toBe("Miles Davis")
  })

  test("standardize_artists=false keeps the credited-as name from this release", () => {
    expect(
      mapMusicBrainzRelease({
        isArtistNameStandardized: false,
        isArtistNameTranslated: false,
        rawRelease: singleArtistRelease,
      }).artistCredit[0].name,
    ).toBe("Miles Davis Quintet")
  })

  test("translate_artist_names=true (locale en) prefers the English alias", () => {
    expect(
      mapMusicBrainzRelease({
        rawRelease: singleArtistRelease,
      }).artistCredit[0].name,
    ).toBe("Miles Dewey Davis III")
  })

  test("translate_artist_names honours a non-default locale", () => {
    expect(
      mapMusicBrainzRelease({
        artistNameLocale: "ja",
        rawRelease: singleArtistRelease,
      }).artistCredit[0].name,
    ).toBe("マイルス・デイヴィス")
  })

  test("convert_punctuation=false leaves curly quotes and long dashes as MusicBrainz has them", () => {
    expect(
      mapMusicBrainzRelease({
        rawRelease: {
          ...singleArtistRelease,
          title: "Don’t Stop — Live",
        },
      }).title,
    ).toBe("Don’t Stop — Live")
  })

  test("convert_punctuation=true rewrites the curly quote and the long dash", () => {
    expect(
      mapMusicBrainzRelease({
        isPunctuationConverted: true,
        rawRelease: {
          ...singleArtistRelease,
          title: "Don’t Stop — Live",
        },
      }).title,
    ).toBe("Don't Stop - Live")
  })

  test("falls back to the release artist credit for tracks that carry none", () => {
    expect(
      mapMusicBrainzRelease({
        isArtistNameTranslated: false,
        rawRelease: singleArtistRelease,
      }).media[0].tracks[0].artistCredit[0].name,
    ).toBe("Miles Davis")
  })

  test("sums the media track counts when the release has no track-count field", () => {
    expect(
      mapMusicBrainzRelease({
        rawRelease: variousArtistsRelease,
      }).trackCount,
    ).toBe(2)
  })
})

describe(deriveIsMultiArtist.name, () => {
  test("treats an empty release as single-artist", () => {
    expect(deriveIsMultiArtist([])).toBe(false)
  })
})

describe(selectLocaleAlias.name, () => {
  test("returns null when the artist has no alias in that locale", () => {
    expect(
      selectLocaleAlias({
        aliases: [{ name: "X", locale: "de" }],
        locale: "en",
      }),
    ).toBeNull()
  })

  test("prefers the primary alias over a non-primary one", () => {
    expect(
      selectLocaleAlias({
        aliases: [
          { name: "Second", locale: "en", primary: false },
          { name: "First", locale: "en", primary: true },
        ],
        locale: "en",
      }),
    ).toBe("First")
  })
})

describe(joinArtistCredit.name, () => {
  test("joins the credit parts with their join phrases", () => {
    expect(
      joinArtistCredit([
        {
          artistId: "a",
          joinPhrase: " feat. ",
          name: "Artist A",
        },
        { artistId: "b", joinPhrase: "", name: "Artist B" },
      ]),
    ).toBe("Artist A feat. Artist B")
  })
})

describe(convertPunctuation.name, () => {
  test("rewrites curly quotes, long dashes and the ellipsis", () => {
    expect(convertPunctuation("‘a’ “b” – — …")).toBe(
      "'a' \"b\" - - ...",
    )
  })
})

describe(selectGenres.name, () => {
  test("excludes the four listening-habit tags so albums never get tagged owned", () => {
    expect(DEFAULT_EXCLUDED_GENRES).toEqual([
      "seen live",
      "favorites",
      "fixme",
      "owned",
    ])
    expect(
      selectGenres({
        folksonomyTags: [
          { count: 10, name: "owned" },
          { count: 10, name: "Seen Live" },
        ],
        releaseGenres: [{ count: 10, name: "jazz" }],
      }),
    ).toEqual(["jazz"])
  })

  test("drops genres used by fewer than 90 percent of the top genre's votes", () => {
    expect(MINIMUM_GENRE_USAGE_PERCENT).toBe(90)
    expect(
      selectGenres({
        releaseGenres: [
          { count: 100, name: "jazz" },
          { count: 95, name: "cool jazz" },
          { count: 50, name: "bebop" },
        ],
      }),
    ).toEqual(["jazz", "cool jazz"])
  })

  test("caps the list at five genres", () => {
    expect(MAXIMUM_GENRE_COUNT).toBe(5)
    expect(
      selectGenres({
        releaseGenres: [
          { count: 10, name: "one" },
          { count: 10, name: "two" },
          { count: 10, name: "three" },
          { count: 10, name: "four" },
          { count: 10, name: "five" },
          { count: 10, name: "six" },
        ],
      }),
    ).toHaveLength(5)
  })

  test("falls back to the artist's genres when the release has none", () => {
    expect(
      selectGenres({
        artistGenres: [{ count: 4, name: "rock" }],
        releaseGenres: [],
      }),
    ).toEqual(["rock"])
  })

  test("uses the release genres and ignores the artist's when the release has its own", () => {
    expect(
      selectGenres({
        artistGenres: [{ count: 40, name: "rock" }],
        releaseGenres: [{ count: 4, name: "jazz" }],
      }),
    ).toEqual(["jazz"])
  })

  test("includes folksonomy tags alongside the genres and merges duplicates", () => {
    expect(
      selectGenres({
        folksonomyTags: [
          { count: 10, name: "Jazz" },
          { count: 20, name: "hard bop" },
        ],
        releaseGenres: [{ count: 12, name: "jazz" }],
      }),
    ).toEqual(["jazz", "hard bop"])
  })

  test("returns a multi-value array, never one joined string", () => {
    const genres = selectGenres({
      releaseGenres: [
        { count: 10, name: "jazz" },
        { count: 10, name: "blues" },
      ],
    })
    expect(Array.isArray(genres)).toBe(true)
    expect(genres).toEqual(["blues", "jazz"])
  })

  test("keeps every genre when all counts are zero", () => {
    expect(
      selectGenres({
        releaseGenres: [
          { count: 0, name: "jazz" },
          { count: 0, name: "blues" },
        ],
      }),
    ).toEqual(["blues", "jazz"])
  })
})

describe(buildReleaseSearchQuery.name, () => {
  test("builds a Lucene query from the parts that are present", () => {
    expect(
      buildReleaseSearchQuery({
        albumName: "Kind of Blue",
        artistName: "Miles Davis",
        trackCount: 5,
      }),
    ).toBe(
      'artist:"Miles Davis" AND release:"Kind of Blue" AND tracks:5',
    )
  })

  test("escapes double quotes so a quoted title cannot truncate the field", () => {
    expect(
      buildReleaseSearchQuery({
        albumName: 'The "Best" Of',
      }),
    ).toBe('release:"The \\"Best\\" Of"')
  })

  test("omits a zero or missing track count", () => {
    expect(
      buildReleaseSearchQuery({
        artistName: "A",
        trackCount: 0,
      }),
    ).toBe('artist:"A"')
  })
})

describe(requireMusicBrainzUserAgent.name, () => {
  const originalUserAgent =
    process.env.MUSICBRAINZ_USER_AGENT

  afterEach(() => {
    process.env.MUSICBRAINZ_USER_AGENT = originalUserAgent
  })

  test("returns the configured descriptive user agent", () => {
    process.env.MUSICBRAINZ_USER_AGENT = "mux-magic/1.0.0"
    expect(requireMusicBrainzUserAgent()).toBe(
      "mux-magic/1.0.0",
    )
  })

  test("throws a message that points at .env.example when it is absent", () => {
    delete process.env.MUSICBRAINZ_USER_AGENT
    expect(() => requireMusicBrainzUserAgent()).toThrow(
      /\.env\.example/u,
    )
  })
})

describe(searchMusicBrainzReleases.name, () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    // Any real network call in this file is a bug. Fail loudly.
    globalThis.fetch = (() => {
      throw new Error("A test made a real network request.")
    }) as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  test("queries /release with fmt=json and Picard's query limit of 50", async () => {
    const cachedFetch = createStubCachedFetch(
      JSON.stringify({ releases: [singleArtistRelease] }),
    )
    const releases = await firstValueFrom(
      searchMusicBrainzReleases({
        albumName: "Kind of Blue",
        artistName: "Miles Davis",
        cachedFetch,
        trackCount: 2,
      }),
    )
    expect(MUSICBRAINZ_QUERY_LIMIT).toBe(50)
    expect(cachedFetch).toHaveBeenCalledOnce()
    const [url] = cachedFetch.mock.calls[0]
    expect(url).toBe(
      "https://musicbrainz.org/ws/2/release?query=artist%3A%22Miles%20Davis%22%20AND%20release%3A%22Kind%20of%20Blue%22%20AND%20tracks%3A2&limit=50&fmt=json",
    )
    expect(releases).toHaveLength(1)
    expect(releases[0].releaseId).toBe("release-1")
  })

  test("emits an empty list when MusicBrainz matched nothing", async () => {
    expect(
      await firstValueFrom(
        searchMusicBrainzReleases({
          albumName: "Nothing",
          cachedFetch: createStubCachedFetch("{}"),
        }),
      ),
    ).toEqual([])
  })

  test("logs and rethrows when the fetcher fails", async () =>
    captureConsoleMessage("error", async () => {
      const failingFetch = (async () => {
        throw new Error(
          "MusicBrainz 503 Service Unavailable",
        )
      }) as unknown as CachedFetch
      await expect(
        firstValueFrom(
          searchMusicBrainzReleases({
            albumName: "Anything",
            cachedFetch: failingFetch,
          }),
        ),
      ).rejects.toThrow(/503/u)
    }))
})

describe(getMusicBrainzRelease.name, () => {
  test("requests artist-rels and recording-rels so soundtrack credits come back", async () => {
    const cachedFetch = createStubCachedFetch(
      JSON.stringify(singleArtistRelease),
    )
    const release = await firstValueFrom(
      getMusicBrainzRelease({
        cachedFetch,
        releaseId: "release-1",
      }),
    )
    const [url] = cachedFetch.mock.calls[0]
    expect(url).toContain(
      "https://musicbrainz.org/ws/2/release/release-1?inc=",
    )
    expect(url).toContain("artist-rels")
    expect(url).toContain("recording-rels")
    expect(url).toContain("recordings")
    expect(url).toContain("artist-credits")
    expect(url).toContain("labels")
    expect(url).toContain("release-groups")
    expect(url).toContain("media")
    expect(url).toContain("fmt=json")
    expect(release.title).toBe("Kind of Blue")
  })
})
