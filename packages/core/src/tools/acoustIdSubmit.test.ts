import { firstValueFrom } from "rxjs"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  buildAcoustIdSubmitBody,
  chunkAcoustIdSubmissions,
  mapAcoustIdSubmitResponse,
  requireAcoustIdUserApiKey,
  submitAcoustIdFingerprints,
} from "./acoustIdSubmit.js"

afterEach(() => {
  vi.unstubAllEnvs()
})

const buildSubmission = (
  overrides: Record<string, unknown> = {},
) => ({
  durationSeconds: 212.4,
  fingerprint: "AQADtInySM3g",
  musicBrainzRecordingId:
    "0349df2b-2bbf-4f21-9ec3-553f5090ac92",
  ...overrides,
})

describe(buildAcoustIdSubmitBody.name, () => {
  // ⚠️ Verified against the live API on 2026-08-25 by sending the keys
  // BOTH ways round. `client`=application key gets past key validation
  // to the parameter check; `client`=account key returns error 4,
  // "invalid API key". They are not interchangeable.
  test("sends the application key as `client` and the account key as `user`", () => {
    const parameters = new URLSearchParams(
      buildAcoustIdSubmitBody({
        apiKey: "application-key",
        submissions: [buildSubmission()],
        userApiKey: "account-key",
      }),
    )

    expect(parameters.get("client")).toBe("application-key")
    expect(parameters.get("user")).toBe("account-key")
  })

  test("indexes each submission by position", () => {
    const parameters = new URLSearchParams(
      buildAcoustIdSubmitBody({
        apiKey: "application-key",
        submissions: [
          buildSubmission({ fingerprint: "FIRST" }),
          buildSubmission({ fingerprint: "SECOND" }),
        ],
        userApiKey: "account-key",
      }),
    )

    expect(parameters.get("fingerprint.0")).toBe("FIRST")
    expect(parameters.get("fingerprint.1")).toBe("SECOND")
  })

  test("rounds the duration, because AcoustID rejects a fractional one", () => {
    expect(
      new URLSearchParams(
        buildAcoustIdSubmitBody({
          apiKey: "application-key",
          submissions: [buildSubmission()],
          userApiKey: "account-key",
        }),
      ).get("duration.0"),
    ).toBe("212")
  })

  // An empty `track` would file a blank title against the fingerprint in
  // a public database, which is worse than sending nothing.
  test("omits an absent optional field rather than sending it empty", () => {
    const parameters = new URLSearchParams(
      buildAcoustIdSubmitBody({
        apiKey: "application-key",
        submissions: [buildSubmission()],
        userApiKey: "account-key",
      }),
    )

    expect(parameters.has("track.0")).toBe(false)
    expect(parameters.has("album.0")).toBe(false)
  })

  test("sends the optional fields that are present", () => {
    const parameters = new URLSearchParams(
      buildAcoustIdSubmitBody({
        apiKey: "application-key",
        submissions: [
          buildSubmission({
            albumName: "Happy Nation",
            artistName: "Ace of Base",
            title: "All That She Wants",
            trackNumber: 1,
          }),
        ],
        userApiKey: "account-key",
      }),
    )

    expect(parameters.get("track.0")).toBe(
      "All That She Wants",
    )
    expect(parameters.get("trackno.0")).toBe("1")
  })
})

describe(mapAcoustIdSubmitResponse.name, () => {
  test("reads back the queued submission ids", () => {
    expect(
      mapAcoustIdSubmitResponse({
        status: "ok",
        submissions: [{ id: 42, status: "pending" }],
      }),
    ).toEqual([{ status: "pending", submissionId: 42 }])
  })

  test("names the swapped-keys mistake on error 4", () => {
    expect(() =>
      mapAcoustIdSubmitResponse({
        error: { code: 4, message: "invalid API key" },
        status: "error",
      }),
    ).toThrow(/ACCOUNT key/u)
  })

  test("surfaces a missing-parameter error as AcoustID phrased it", () => {
    expect(() =>
      mapAcoustIdSubmitResponse({
        error: {
          code: 2,
          message:
            'missing required parameter "fingerprint"',
        },
        status: "error",
      }),
    ).toThrow(/missing required parameter "fingerprint"/u)
  })
})

describe(requireAcoustIdUserApiKey.name, () => {
  test("says which of the two keys is wanted", () => {
    vi.stubEnv("ACOUSTID_USER_API_KEY", "")

    expect(requireAcoustIdUserApiKey).toThrow(
      /account key/u,
    )
  })
})

describe(chunkAcoustIdSubmissions.name, () => {
  test("splits a library-sized pass into readable batches", () => {
    expect(
      chunkAcoustIdSubmissions({
        batchSize: 4,
        submissions: Array.from({ length: 9 }, () =>
          buildSubmission(),
        ),
      }).map((batch) => batch.length),
    ).toEqual([4, 4, 1])
  })

  test("an empty set produces no batches, so nothing is posted", () => {
    expect(
      chunkAcoustIdSubmissions({ submissions: [] }),
    ).toEqual([])
  })
})

describe(submitAcoustIdFingerprints.name, () => {
  test("POSTs the batch and returns the queued ids", async () => {
    const fetchImplementation = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            status: "ok",
            submissions: [{ id: 7, status: "pending" }],
          }),
        ),
      ),
    )

    expect(
      await firstValueFrom(
        submitAcoustIdFingerprints({
          apiKey: "application-key",
          fetchImplementation,
          submissions: [buildSubmission()],
          userApiKey: "account-key",
        }),
      ),
    ).toEqual([{ status: "pending", submissionId: 7 }])
  })

  // Nothing to say means nothing to send. A public database write with an
  // empty batch is a wasted request at best.
  test("sends no request at all for an empty batch", async () => {
    const fetchImplementation = vi.fn(() =>
      Promise.resolve(new Response("{}")),
    )

    expect(
      await firstValueFrom(
        submitAcoustIdFingerprints({
          apiKey: "application-key",
          fetchImplementation,
          submissions: [],
          userApiKey: "account-key",
        }),
      ),
    ).toEqual([])
    expect(fetchImplementation).not.toHaveBeenCalled()
  })
})
