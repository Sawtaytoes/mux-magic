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
  buildBarcodeSubmissionBody,
  buildIsrcSubmissionBody,
  buildMusicBrainzAuthorizeUrl,
  buildRatingSubmissionBody,
  buildSeededReleaseFields,
  buildSeededReleaseForm,
  buildSubmissionUrl,
  buildTagSubmissionBody,
  exchangeMusicBrainzAuthorizationCode,
  MUSICBRAINZ_CLIENT_ID_PARAMETER,
  submitToMusicBrainz,
} from "./musicBrainzSubmit.js"

beforeEach(() => {
  vi.stubEnv(
    "MUSICBRAINZ_USER_AGENT",
    "mux-magic-test/0.0.0 ( test@example.com )",
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const RECORDING_ID = "0349df2b-2bbf-4f21-9ec3-553f5090ac92"

describe(buildSubmissionUrl.name, () => {
  // Verified live on 2026-08-25: all four paths exist and answer 401 to
  // an unauthenticated POST, which is what proves the URLs are right
  // without making a public edit.
  test.each([
    ["tag", "/ws/2/tag"],
    ["rating", "/ws/2/rating"],
    ["barcode", "/ws/2/release/"],
    ["isrc", "/ws/2/recording/"],
  ] as const)("%s posts to %s", (kind, path) => {
    expect(buildSubmissionUrl(kind)).toContain(path)
  })

  // Separate from the User-Agent, and MusicBrainz rejects a submission
  // without it.
  test("every submission carries the client parameter", () => {
    expect(buildSubmissionUrl("tag")).toContain(
      `client=${MUSICBRAINZ_CLIENT_ID_PARAMETER}`,
    )
  })
})

describe(buildTagSubmissionBody.name, () => {
  test("wraps each tag in a user-tag under its recording", () => {
    const body = buildTagSubmissionBody([
      { recordingId: RECORDING_ID, tags: ["pop", "swing"] },
    ])

    expect(body).toContain(
      `<recording id="${RECORDING_ID}"`,
    )
    expect(body).toContain("<user-tag><name>pop</name>")
    expect(body).toContain("<user-tag><name>swing</name>")
  })

  // An ampersand in a band name would otherwise close the element early
  // and the whole submission would be rejected as malformed XML.
  test("escapes XML in a tag value", () => {
    expect(
      buildTagSubmissionBody([
        {
          recordingId: RECORDING_ID,
          tags: ["rhythm & blues"],
        },
      ]),
    ).toContain("rhythm &amp; blues")
  })
})

describe(buildRatingSubmissionBody.name, () => {
  // MusicBrainz stores a rating out of 100 and shows it as five stars.
  // Sending 4 rather than 80 quietly files a one-fifth-of-a-star rating.
  test("converts stars to the hundred-point scale", () => {
    expect(
      buildRatingSubmissionBody([
        { recordingId: RECORDING_ID, stars: 4 },
      ]),
    ).toContain("<user-rating>80</user-rating>")
  })
})

describe(buildBarcodeSubmissionBody.name, () => {
  test("puts the barcode under its release", () => {
    expect(
      buildBarcodeSubmissionBody([
        {
          barcode: "731453998520",
          releaseId: "release-1",
        },
      ]),
    ).toContain("<barcode>731453998520</barcode>")
  })
})

describe(buildIsrcSubmissionBody.name, () => {
  test("counts the ISRCs it lists", () => {
    expect(
      buildIsrcSubmissionBody([
        {
          isrcs: ["USRC17607839", "GBAYE0601498"],
          recordingId: RECORDING_ID,
        },
      ]),
    ).toContain('<isrc-list count="2">')
  })
})

describe(submitToMusicBrainz.name, () => {
  test("sends the OAuth token and the descriptive user agent", async () => {
    const sentHeaders: Record<string, string>[] = []
    const fetchImplementation: typeof globalThis.fetch = (
      _url,
      initialization,
    ) => {
      sentHeaders.push(
        (initialization?.headers ?? {}) as Record<
          string,
          string
        >,
      )
      return Promise.resolve(
        new Response("", { status: 200 }),
      )
    }

    await firstValueFrom(
      submitToMusicBrainz({
        accessToken: "token-1",
        body: "<metadata/>",
        fetchImplementation,
        kind: "tag",
      }),
    )

    expect(sentHeaders[0].Authorization).toBe(
      "Bearer token-1",
    )
    expect(sentHeaders[0]["User-Agent"]).toContain(
      "mux-magic",
    )
  })

  // A submission is an edit on the owner's account. Verified live: all
  // four endpoints answer 401 without a token, and authorisation is
  // checked before the `client` parameter is.
  test("refuses to send without a token, and says why", async () => {
    await expect(
      firstValueFrom(
        submitToMusicBrainz({
          accessToken: "",
          body: "<metadata/>",
          fetchImplementation: vi.fn(),
          kind: "tag",
        }),
      ),
    ).rejects.toThrow(/OAuth access token/u)
  })

  test("surfaces the server's own words on a rejection", async () => {
    await expect(
      firstValueFrom(
        submitToMusicBrainz({
          accessToken: "token-1",
          body: "<metadata/>",
          fetchImplementation: vi.fn(() =>
            Promise.resolve(
              new Response(
                "<error><text>You are not authorized</text></error>",
                { status: 401 },
              ),
            ),
          ),
          kind: "tag",
        }),
      ),
    ).rejects.toThrow(/You are not authorized/u)
  })
})

describe(buildMusicBrainzAuthorizeUrl.name, () => {
  test("asks for only the four submission scopes", () => {
    expect(
      new URL(
        buildMusicBrainzAuthorizeUrl({
          clientId: "client-1",
          redirectUri: "https://example.com/callback",
        }),
      ).searchParams.get("scope"),
    ).toBe("tag rating submit_isrc submit_barcode")
  })
})

describe(exchangeMusicBrainzAuthorizationCode.name, () => {
  test("returns the access token", async () => {
    expect(
      await firstValueFrom(
        exchangeMusicBrainzAuthorizationCode({
          authorizationCode: "code-1",
          clientId: "client-1",
          clientSecret: "secret-1",
          fetchImplementation: vi.fn(() =>
            Promise.resolve(
              new Response(
                JSON.stringify({
                  access_token: "token-1",
                  expires_in: 3600,
                  refresh_token: "refresh-1",
                }),
              ),
            ),
          ),
          redirectUri: "https://example.com/callback",
        }),
      ),
    ).toEqual({
      accessToken: "token-1",
      expiresInSeconds: 3600,
      refreshToken: "refresh-1",
    })
  })

  test("surfaces the OAuth error description", async () => {
    await expect(
      firstValueFrom(
        exchangeMusicBrainzAuthorizationCode({
          authorizationCode: "code-1",
          clientId: "client-1",
          clientSecret: "secret-1",
          fetchImplementation: vi.fn(() =>
            Promise.resolve(
              new Response(
                JSON.stringify({
                  error: "invalid_grant",
                  error_description:
                    "The authorization code has expired",
                }),
              ),
            ),
          ),
          redirectUri: "https://example.com/callback",
        }),
      ),
    ).rejects.toThrow(/authorization code has expired/u)
  })
})

const SEEDED_RELEASE = {
  albumArtistName: "Nova Harbour",
  releaseTitle: "Tidewater",
  tracks: [
    {
      lengthMilliseconds: 210_000,
      title: "Slack Water",
      trackNumber: 1,
    },
    {
      lengthMilliseconds: 185_400,
      title: "Spring Tide",
      trackNumber: 2,
    },
  ],
}

describe(buildSeededReleaseFields.name, () => {
  // ⚠️ An ORDERED pair list, not an object. The release editor reads the
  // primary type and each secondary type as REPEATED `type` inputs, and
  // an object can hold only one.
  test("repeats the `type` input for each secondary type", () => {
    expect(
      buildSeededReleaseFields({
        ...SEEDED_RELEASE,
        primaryType: "Album",
        secondaryTypes: ["Compilation", "Soundtrack"],
      })
        .filter(([name]) => name === "type")
        .map(([, value]) => value),
    ).toEqual(["Album", "Compilation", "Soundtrack"])
  })

  test("indexes the tracklist the way the editor expects", () => {
    const fields = new Map(
      buildSeededReleaseFields(SEEDED_RELEASE),
    )

    expect(fields.get("mediums.0.track.0.name")).toBe(
      "Slack Water",
    )
    expect(fields.get("mediums.0.track.1.number")).toBe("2")
    expect(fields.get("mediums.0.track.1.length")).toBe(
      "185400",
    )
  })

  test("splits a full date into year, month and day", () => {
    const fields = new Map(
      buildSeededReleaseFields({
        ...SEEDED_RELEASE,
        date: "2026-07-06",
      }),
    )

    expect(fields.get("events.0.date.year")).toBe("2026")
    expect(fields.get("events.0.date.month")).toBe("7")
    expect(fields.get("events.0.date.day")).toBe("6")
  })

  test("a year-only date sends only the year", () => {
    const fields = new Map(
      buildSeededReleaseFields({
        ...SEEDED_RELEASE,
        date: "2026",
      }),
    )

    expect(fields.get("events.0.date.year")).toBe("2026")
    expect(fields.has("events.0.date.month")).toBe(false)
  })

  test("defaults suit a digital release", () => {
    const fields = new Map(
      buildSeededReleaseFields(SEEDED_RELEASE),
    )

    expect(fields.get("events.0.country")).toBe("XW")
    expect(fields.get("mediums.0.format")).toBe(
      "Digital Media",
    )
  })

  test("links the artist credit when an MBID is known", () => {
    expect(
      new Map(
        buildSeededReleaseFields({
          ...SEEDED_RELEASE,
          artistMbid:
            "0a14492b-4f8d-405c-adb5-f3e47b8edaff",
        }),
      ).get("artist_credit.names.0.mbid"),
    ).toBe("0a14492b-4f8d-405c-adb5-f3e47b8edaff")
  })
})

describe(buildSeededReleaseForm.name, () => {
  // ⚠️ The seed MUST travel in a form POST body. Passing it as query
  // parameters was tried and the editor opened completely empty.
  test("posts the seed to the release editor", () => {
    const form = buildSeededReleaseForm(SEEDED_RELEASE)

    expect(form).toContain('method="POST"')
    expect(form).toContain(
      'action="https://musicbrainz.org/release/add"',
    )
  })

  test("carries every field as a hidden input", () => {
    expect(
      buildSeededReleaseForm(SEEDED_RELEASE),
    ).toContain(
      '<input type="hidden" name="mediums.0.track.0.name" value="Slack Water">',
    )
  })

  // Opening the editor saves nothing. Leaving that unsaid is how someone
  // walks away believing the release was created.
  test("tells the user that Enter edit is what creates the release", () => {
    expect(
      buildSeededReleaseForm(SEEDED_RELEASE),
    ).toContain("Enter edit")
  })

  test("escapes a quote in a title rather than breaking the input", () => {
    expect(
      buildSeededReleaseForm({
        ...SEEDED_RELEASE,
        releaseTitle: 'The "Lost" Tapes',
      }),
    ).toContain("The &quot;Lost&quot; Tapes")
  })
})
