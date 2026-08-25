import { firstValueFrom } from "rxjs"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import {
  ACOUSTID_LOOKUP_URL,
  buildAcoustIdLookupBody,
  lookupAcoustId,
  mapAcoustIdResponse,
  requireAcoustIdApiKey,
} from "./acoustIdApi.js"
import type { CachedFetch } from "./musicBrainzApi.js"

afterEach(() => {
  vi.unstubAllEnvs()
})

const okResponse = JSON.stringify({
  results: [
    {
      id: "39f483a4-1706-4529-a2a7-80d3e43bade0",
      recordings: [
        {
          artists: [
            {
              id: "d4a1404d-e00c-4bac-b3ba-e3557f6468d6",
              name: "Ace of Base",
            },
          ],
          duration: 212.066,
          id: "0349df2b-2bbf-4f21-9ec3-553f5090ac92",
          releasegroups: [
            {
              id: "release-group-1",
              title: "Happy Nation",
            },
          ],
          title: "All That She Wants",
        },
      ],
      score: 0.967_892_94,
    },
  ],
  status: "ok",
})

describe(buildAcoustIdLookupBody.name, () => {
  // ⚠️ The one that actually bites. Every published example writes
  // `meta=recordings+releasegroups`, which is a GET URL where `+` means a
  // space. Form-encoding it sends a literal `+`, AcoustID reads one
  // unknown meta name, and answers 200 OK with the recordings missing and
  // nothing to say why. Measured against the live API on 2026-08-25.
  test("separates meta values with a space, never a plus", () => {
    const body = buildAcoustIdLookupBody({
      apiKey: "app-key",
      durationSeconds: 212,
      fingerprint: "AQADtInySM3g",
    })

    expect(new URLSearchParams(body).get("meta")).toBe(
      "recordings releasegroups",
    )
    expect(body).not.toContain("recordings%2B")
  })

  test("rounds the duration, because AcoustID rejects a fractional one", () => {
    expect(
      new URLSearchParams(
        buildAcoustIdLookupBody({
          apiKey: "app-key",
          durationSeconds: 183.24,
          fingerprint: "AQADtInySM3g",
        }),
      ).get("duration"),
    ).toBe("183")
  })

  test("sends the application key as `client`", () => {
    expect(
      new URLSearchParams(
        buildAcoustIdLookupBody({
          apiKey: "app-key",
          durationSeconds: 212,
          fingerprint: "AQADtInySM3g",
        }),
      ).get("client"),
    ).toBe("app-key")
  })
})

describe(mapAcoustIdResponse.name, () => {
  test("maps a match down to recording ids, artists and release groups", () => {
    expect(
      mapAcoustIdResponse(
        JSON.parse(okResponse) as Parameters<
          typeof mapAcoustIdResponse
        >[0],
      ),
    ).toEqual([
      {
        acoustId: "39f483a4-1706-4529-a2a7-80d3e43bade0",
        recordings: [
          {
            artistNames: ["Ace of Base"],
            durationSeconds: 212.066,
            musicBrainzArtistIds: [
              "d4a1404d-e00c-4bac-b3ba-e3557f6468d6",
            ],
            recordingId:
              "0349df2b-2bbf-4f21-9ec3-553f5090ac92",
            releaseGroupIds: ["release-group-1"],
            title: "All That She Wants",
          },
        ],
        score: 0.967_892_94,
      },
    ])
  })

  test("sorts by score, best first", () => {
    expect(
      mapAcoustIdResponse({
        results: [
          { id: "low", score: 0.4 },
          { id: "high", score: 0.9 },
        ],
        status: "ok",
      }).map((match) => match.acoustId),
    ).toEqual(["high", "low"])
  })

  // A real AcoustID id with a real score and no linked recording is
  // common — the audio is known, nobody has tied it to MusicBrainz. It is
  // a row, not a failure.
  test("keeps a scored result that has no recordings", () => {
    expect(
      mapAcoustIdResponse({
        results: [
          {
            id: "40b773c9-b01d-4ca7-93c3-7eae26c932a4",
            score: 1,
          },
        ],
        status: "ok",
      }),
    ).toEqual([
      {
        acoustId: "40b773c9-b01d-4ca7-93c3-7eae26c932a4",
        recordings: [],
        score: 1,
      },
    ])
  })

  test("names the two-key mistake when AcoustID answers error 4", () => {
    expect(() =>
      mapAcoustIdResponse({
        error: { code: 4, message: "invalid API key" },
        status: "error",
      }),
    ).toThrow(/APPLICATION key, not the account key/u)
  })

  test("surfaces any other AcoustID error", () => {
    expect(() =>
      mapAcoustIdResponse({
        error: {
          code: 2,
          message: "invalid fingerprint",
        },
        status: "error",
      }),
    ).toThrow(/AcoustID error 2: invalid fingerprint/u)
  })
})

describe(requireAcoustIdApiKey.name, () => {
  test("explains which of the two keys is wanted", () => {
    vi.stubEnv("ACOUSTID_API_KEY", "")

    expect(requireAcoustIdApiKey).toThrow(
      /ACOUSTID_API_KEY is not set/u,
    )
  })
})

describe(lookupAcoustId.name, () => {
  test("POSTs the fingerprint and returns the mapped matches", async () => {
    const cachedFetch = vi.fn(() =>
      Promise.resolve({
        body: okResponse,
        isFromCache: false,
      }),
    )

    const matches = await firstValueFrom(
      lookupAcoustId({
        apiKey: "app-key",
        cachedFetch,
        durationSeconds: 212,
        fingerprint: "AQADtInySM3g",
      }),
    )

    expect(matches[0]?.recordings[0]?.title).toBe(
      "All That She Wants",
    )
    expect(cachedFetch).toHaveBeenCalledWith(
      ACOUSTID_LOOKUP_URL,
      expect.objectContaining({ method: "POST" }),
    )
  })

  // Every lookup posts to the same URL, and the provider cache is keyed on
  // the URL. Without a fingerprint-specific cache key, track 2 reads back
  // track 1's answer and a whole album matches as one song.
  test("gives each fingerprint its own cache key", async () => {
    const cacheKeys: (string | undefined)[] = []
    const cachedFetch: CachedFetch = (_url, init) => {
      cacheKeys.push(init?.cacheKey)
      return Promise.resolve({
        body: okResponse,
        isFromCache: false,
      })
    }

    await firstValueFrom(
      lookupAcoustId({
        apiKey: "app-key",
        cachedFetch,
        durationSeconds: 212,
        fingerprint: "FIRST",
      }),
    )
    await firstValueFrom(
      lookupAcoustId({
        apiKey: "app-key",
        cachedFetch,
        durationSeconds: 212,
        fingerprint: "SECOND",
      }),
    )

    expect(cacheKeys).toEqual([
      `${ACOUSTID_LOOKUP_URL}#212:FIRST`,
      `${ACOUSTID_LOOKUP_URL}#212:SECOND`,
    ])
  })
})
