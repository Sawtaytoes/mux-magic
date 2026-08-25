import { firstValueFrom } from "rxjs"
import { describe, expect, test, vi } from "vitest"

import {
  buildDiscId,
  buildQueryCommand,
  buildTrackOffsets,
  extractVgmdbAlbumId,
  FREEDB_CDDB_SERVER,
  getTotalDiscSeconds,
  parseQueryResponse,
  parseReadResponse,
  parseXmcd,
  queryVgmdbCddb,
  readVgmdbCddbAlbum,
  splitDiscTitle,
} from "./cddbApi.js"

// ⚠️ These two disc ids are not invented. They were computed by this code
// and then ACCEPTED by the live VGMdb CDDB server on 2026-08-25, which
// returned real album matches for both. They are the regression guard for
// the whole offset and checksum calculation — if either changes, the
// command stops matching anything and no other test would notice.
//
// The track lengths come from two real albums; the albums are not named
// here, because this repository is publishable.
const EIGHT_TRACK_LENGTHS = [
  488.36, 170.626_667, 631, 216.466_667, 183.533_333, 631,
  269, 125.746_667,
]
const EIGHT_TRACK_DISC_ID = "610a9b08"

const ELEVEN_TRACK_LENGTHS = [
  248.96, 205.04, 228.533_333, 279.933_333, 273.893_333,
  244.4, 312.973_333, 285.066_667, 227.493_333, 322.133_333,
  340.706_667,
]
const ELEVEN_TRACK_DISC_ID = "920b990b"

describe(buildTrackOffsets.name, () => {
  // A disc starts after a two-second lead-in. Starting at 0 shifts every
  // offset and the disc id matches nothing.
  test("starts the first track at the lead-in, not at zero", () => {
    expect(buildTrackOffsets([100, 200])[0]).toBe(150)
  })

  test("each track starts where the previous one ended", () => {
    expect(buildTrackOffsets([100, 200])).toEqual([
      150,
      150 + 100 * 75,
    ])
  })

  test("an empty disc has no offsets", () => {
    expect(buildTrackOffsets([])).toEqual([])
  })
})

describe(getTotalDiscSeconds.name, () => {
  test("counts the lead-in as part of the disc", () => {
    expect(getTotalDiscSeconds([100, 200])).toBe(302)
  })
})

describe(buildDiscId.name, () => {
  test.each([
    [
      "eight tracks",
      EIGHT_TRACK_LENGTHS,
      EIGHT_TRACK_DISC_ID,
    ],
    [
      "eleven tracks",
      ELEVEN_TRACK_LENGTHS,
      ELEVEN_TRACK_DISC_ID,
    ],
  ])("reproduces the id the live server accepted for %s", (_label, lengths, expectedDiscId) => {
    expect(buildDiscId(lengths)).toBe(expectedDiscId)
  })

  test("is always eight hex digits", () => {
    expect(buildDiscId([1, 2, 3])).toMatch(/^[0-9a-f]{8}$/u)
  })

  // ⚠️ The checksum occupies the TOP byte, and JavaScript's bitwise
  // operators produce a SIGNED result. Without the unsigned coercion a
  // disc whose checksum lands above 127 prints as a negative hex number
  // and matches nothing — on roughly half of all discs.
  test("never produces a negative id, whatever the checksum", () => {
    const longDisc = Array.from(
      { length: 20 },
      (_unused, index) => 300 + index * 37,
    )

    expect(buildDiscId(longDisc)).not.toContain("-")
    expect(buildDiscId(longDisc)).toMatch(/^[0-9a-f]{8}$/u)
  })

  test("the last byte is the track count", () => {
    expect(buildDiscId(EIGHT_TRACK_LENGTHS).slice(-2)).toBe(
      "08",
    )
  })
})

describe(buildQueryCommand.name, () => {
  test("sends id, count, every offset and the total length", () => {
    expect(buildQueryCommand(EIGHT_TRACK_LENGTHS)).toBe(
      "cddb query 610a9b08 8 150 36777 49574 96899 113134 126899 174224 194399 2717",
    )
  })
})

describe(parseQueryResponse.name, () => {
  test("reads a single exact match off the status line", () => {
    expect(
      parseQueryResponse({
        body: "200 Soundtrack141255 920b990b [KSCL-3405] An Album (Disc 6)",
      }),
    ).toEqual([
      {
        albumTitle: "[KSCL-3405] An Album (Disc 6)",
        category: "Soundtrack141255",
        discId: "920b990b",
        vgmdbAlbumId: "141255",
      },
    ])
  })

  test("reads an inexact list up to the terminating marker", () => {
    expect(
      parseQueryResponse({
        body: [
          "211 Found inexact matches list follows (until terminating marker `.')",
          "Soundtrack32937 610a9b08 First Album",
          "Soundtrack46513 610a9b08 Second Album",
          ".",
          "",
        ].join("\n"),
      }).map((match) => match.vgmdbAlbumId),
    ).toEqual(["32937", "46513"])
  })

  // An album VGMdb has never seen is a normal outcome, not a failure.
  test("no match is an empty list, not an error", () => {
    expect(
      parseQueryResponse({ body: "202 No match found" }),
    ).toEqual([])
  })

  test("survives an empty body", () => {
    expect(parseQueryResponse({ body: "" })).toEqual([])
  })
})

describe(extractVgmdbAlbumId.name, () => {
  test("takes the numeric tail off the category", () => {
    expect(extractVgmdbAlbumId("Soundtrack141255")).toBe(
      "141255",
    )
  })

  test("a category with no id yields an empty string", () => {
    expect(extractVgmdbAlbumId("Soundtrack")).toBe("")
  })
})

describe(parseXmcd.name, () => {
  test("ignores comment lines", () => {
    expect(
      parseXmcd("# a comment\nDYEAR=2011").get("DYEAR"),
    ).toBe("2011")
  })

  // A value too long for one line is CONTINUED by repeating the key.
  // Overwriting instead of joining truncates the title.
  test("joins a value continued across repeated keys", () => {
    expect(
      parseXmcd(
        "TTITLE0=The Legend of \nTTITLE0=Zelda Medley",
      ).get("TTITLE0"),
    ).toBe("The Legend of Zelda Medley")
  })

  test("keeps an equals sign inside a value", () => {
    expect(parseXmcd("DTITLE=a=b").get("DTITLE")).toBe(
      "a=b",
    )
  })
})

describe(splitDiscTitle.name, () => {
  test("splits artist from album", () => {
    expect(
      splitDiscTitle("Some Artist / Some Album"),
    ).toEqual({
      albumTitle: "Some Album",
      artistName: "Some Artist",
    })
  })

  // VGMdb frequently leaves the artist empty and answers " / Album".
  test("tolerates an empty artist", () => {
    expect(
      splitDiscTitle(" / [RVL-SOUP-EUR] Some Album"),
    ).toEqual({
      albumTitle: "[RVL-SOUP-EUR] Some Album",
      artistName: "",
    })
  })

  // Splitting on every separator would truncate this title.
  test("keeps a separator that is part of the album title", () => {
    expect(
      splitDiscTitle("Artist / Album A / Album B"),
    ).toEqual({
      albumTitle: "Album A / Album B",
      artistName: "Artist",
    })
  })
})

const READ_BODY = [
  "210 Soundtrack32937 610a9b08",
  "# xmcd",
  "#",
  "# Track frame offsets:",
  "#	0",
  "#",
  "DTITLE= / [RVL-SOUP-EUR] An Orchestra CD",
  "DYEAR=2011",
  "DGENRE=Game",
  "TTITLE0=First Track",
  "TTITLE1=Second Track",
  ".",
].join("\n")

describe(parseReadResponse.name, () => {
  test("reads the album, year, genre and tracklist", () => {
    expect(
      parseReadResponse({
        body: READ_BODY,
        category: "Soundtrack32937",
        discId: "610a9b08",
      }),
    ).toEqual({
      albumTitle: "[RVL-SOUP-EUR] An Orchestra CD",
      artistName: "",
      category: "Soundtrack32937",
      discId: "610a9b08",
      genre: "Game",
      trackTitles: ["First Track", "Second Track"],
      vgmdbAlbumId: "32937",
      year: "2011",
    })
  })

  // Ten tracks must not sort as 1, 10, 2. A track's POSITION is its
  // number, so the order is the data.
  test("orders tracks numerically, not as text", () => {
    expect(
      parseReadResponse({
        body: [
          "TTITLE0=one",
          "TTITLE10=eleven",
          "TTITLE2=three",
        ].join("\n"),
        category: "Soundtrack1",
        discId: "abc",
      }).trackTitles,
    ).toEqual(["one", "three", "eleven"])
  })
})

describe(queryVgmdbCddb.name, () => {
  test("asks for UTF-8, because VGMdb is full of Japanese titles", async () => {
    const requestedUrls: string[] = []
    const cachedFetch = (url: string) => {
      requestedUrls.push(url)
      return Promise.resolve({
        body: "202 No match found",
        isFromCache: false,
      })
    }

    await firstValueFrom(
      queryVgmdbCddb({
        cachedFetch,
        trackLengthsSeconds: [100, 200],
      }),
    )

    expect(requestedUrls[0]).toContain("proto=6")
    expect(requestedUrls[0]).toContain("cddb+query")
  })

  test("puts the language on the path when one is asked for", async () => {
    const requestedUrls: string[] = []
    const cachedFetch = (url: string) => {
      requestedUrls.push(url)
      return Promise.resolve({
        body: "202 No match found",
        isFromCache: false,
      })
    }

    await firstValueFrom(
      queryVgmdbCddb({
        cachedFetch,
        language: "ja-Latn",
        trackLengthsSeconds: [100],
      }),
    )

    expect(requestedUrls[0]).toContain(
      "/cddb/ja-Latn/cddb.cgi",
    )
  })

  test("the default language uses the bare path", async () => {
    const requestedUrls: string[] = []
    const cachedFetch = (url: string) => {
      requestedUrls.push(url)
      return Promise.resolve({
        body: "202 No match found",
        isFromCache: false,
      })
    }

    await firstValueFrom(
      queryVgmdbCddb({
        cachedFetch,
        trackLengthsSeconds: [100],
      }),
    )

    expect(requestedUrls[0]).toContain("/cddb/cddb.cgi")
  })
})

describe(readVgmdbCddbAlbum.name, () => {
  test("reads one album by category and disc id", async () => {
    const cachedFetch = vi.fn(() =>
      Promise.resolve({
        body: READ_BODY,
        isFromCache: false,
      }),
    )

    expect(
      (
        await firstValueFrom(
          readVgmdbCddbAlbum({
            cachedFetch,
            category: "Soundtrack32937",
            discId: "610a9b08",
          }),
        )
      ).trackTitles,
    ).toEqual(["First Track", "Second Track"])
  })
})

describe("freedb versus VGMdb", () => {
  // ⚠️ VGMdb encodes its album id in the CATEGORY (`Soundtrack141255`).
  // General freedb uses real freedb categories — `misc`, `rock`, `data` —
  // which carry no id at all. Reading an id out of one would invent a
  // VGMdb album number from the word "misc".
  test("freedb categories yield no album id", () => {
    expect(
      parseQueryResponse({
        body: "200 misc 610a9b08 Nintendo / The Legend of Zelda",
        server: FREEDB_CDDB_SERVER,
      }),
    ).toEqual([
      {
        albumTitle: "Nintendo / The Legend of Zelda",
        category: "misc",
        discId: "610a9b08",
        vgmdbAlbumId: "",
      },
    ])
  })

  test("VGMdb categories still yield one", () => {
    expect(
      parseQueryResponse({
        body: "200 Soundtrack141255 920b990b An Album",
      })[0]?.vgmdbAlbumId,
    ).toBe("141255")
  })

  // freedb has no language paths. Asking for one anyway must not produce
  // a URL that 404s.
  test("freedb ignores a language segment", async () => {
    const requestedUrls: string[] = []
    const cachedFetch = (url: string) => {
      requestedUrls.push(url)
      return Promise.resolve({
        body: "202 No match found",
        isFromCache: false,
      })
    }

    await firstValueFrom(
      queryVgmdbCddb({
        cachedFetch,
        language: "ja-Latn",
        server: FREEDB_CDDB_SERVER,
        trackLengthsSeconds: [100],
      }),
    )

    expect(requestedUrls[0]).not.toContain("ja-Latn")
    expect(requestedUrls[0]).toContain(
      "freedb.dbpoweramp.com/~cddb/cddb.cgi",
    )
  })

  // freedb populates the artist properly, unlike VGMdb which usually
  // leaves it empty. The same parser has to handle both.
  test("reads freedb's populated artist", () => {
    expect(
      parseReadResponse({
        body: "DTITLE=Nintendo / The Legend of Zelda\nTTITLE0=Overworld",
        category: "misc",
        discId: "610a9b08",
        server: FREEDB_CDDB_SERVER,
      }),
    ).toMatchObject({
      albumTitle: "The Legend of Zelda",
      artistName: "Nintendo",
      vgmdbAlbumId: "",
    })
  })
})
