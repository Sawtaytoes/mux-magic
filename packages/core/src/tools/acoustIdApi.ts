import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { from, map, type Observable } from "rxjs"

import type { CachedFetch } from "./musicBrainzApi.js"

// AcoustID: fingerprint in, MusicBrainz recording ids out. The house
// pattern applies — a hand-written client with a locally-declared subset
// of the response, so the tests run on synthetic input and no SDK is
// added.

export const ACOUSTID_LOOKUP_URL =
  "https://api.acoustid.org/v2/lookup"

// AcoustID documents three requests per second. Its limiter is per
// application key, so exceeding it burns the household's key rather than
// its address. 350 ms leaves a margin for clock jitter.
export const ACOUSTID_MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 350

// ⚠️ Verified against the live API on 2026-08-25: the values in `meta`
// are separated by a SPACE, not a `+`.
//
// Every example in the wild writes `meta=recordings+releasegroups`,
// because those examples are GET URLs where `+` IS the space. This client
// POSTs a form body (the fingerprint is several kilobytes), and a form
// encoder escapes `+` to `%2B`. AcoustID then reads one unknown meta name
// and answers 200 OK with the metadata silently missing — `recordings`
// never appears and nothing says why. Measured, side by side:
//
//   meta="recordings"                 → keys id, score, recordings (13)
//   meta="recordings+releasegroups"   → keys id, score            (none)
//   meta="recordings releasegroups"   → keys id, score, recordings (13)
//
// So this stays an array joined with a space. Do not "tidy" it to a `+`.
export const ACOUSTID_LOOKUP_META = [
  "recordings",
  "releasegroups",
]

// AcoustID error 4 is "invalid API key", and it is what the ACCOUNT key
// returns when it is sent as `client=`. The two keys are not
// interchangeable: `client` is the APPLICATION key, and the account key
// only ever authorises a submission.
export const ACOUSTID_INVALID_API_KEY_ERROR_CODE = 4

export type AcoustIdRawArtist = {
  id?: string
  name?: string
}

export type AcoustIdRawReleaseGroup = {
  id?: string
  title?: string
  secondarytypes?: string[]
  type?: string
}

export type AcoustIdRawRecording = {
  artists?: AcoustIdRawArtist[]
  duration?: number
  id?: string
  releasegroups?: AcoustIdRawReleaseGroup[]
  title?: string
}

export type AcoustIdRawResult = {
  id?: string
  recordings?: AcoustIdRawRecording[]
  score?: number
}

export type AcoustIdRawLookupResponse = {
  error?: { code?: number; message?: string }
  results?: AcoustIdRawResult[]
  status?: string
}

export type AcoustIdRecording = {
  artistNames: string[]
  durationSeconds: number | null
  musicBrainzArtistIds: string[]
  recordingId: string
  releaseGroupIds: string[]
  title: string
}

export type AcoustIdMatch = {
  acoustId: string
  recordings: AcoustIdRecording[]
  score: number
}

const throwMissingApiKey = (): never => {
  throw new Error(
    "ACOUSTID_API_KEY is not set. AcoustID refuses a lookup without an application key. Register one at https://acoustid.org/new-application and add it to .env (see .env.example). It is NOT the account key from your AcoustID user page — sending that one as `client` returns error 4.",
  )
}

export const requireAcoustIdApiKey = () =>
  process.env.ACOUSTID_API_KEY || throwMissingApiKey()

const mapRecording = (
  rawRecording: AcoustIdRawRecording,
): AcoustIdRecording => ({
  artistNames: (rawRecording.artists ?? [])
    .map((rawArtist) => rawArtist.name ?? "")
    .filter((artistName) => artistName.length > 0),
  durationSeconds: rawRecording.duration ?? null,
  musicBrainzArtistIds: (rawRecording.artists ?? [])
    .map((rawArtist) => rawArtist.id ?? "")
    .filter((artistId) => artistId.length > 0),
  recordingId: rawRecording.id ?? "",
  releaseGroupIds: (rawRecording.releasegroups ?? [])
    .map((rawReleaseGroup) => rawReleaseGroup.id ?? "")
    .filter((releaseGroupId) => releaseGroupId.length > 0),
  title: rawRecording.title ?? "",
})

export const mapAcoustIdResponse = (
  rawResponse: AcoustIdRawLookupResponse,
): AcoustIdMatch[] =>
  rawResponse.status === "ok"
    ? (rawResponse.results ?? [])
        .filter(
          (rawResult) =>
            typeof rawResult.id === "string" &&
            rawResult.id.length > 0,
        )
        .map((rawResult) => ({
          acoustId: rawResult.id ?? "",
          recordings: (rawResult.recordings ?? [])
            .filter(
              (rawRecording) =>
                typeof rawRecording.id === "string" &&
                rawRecording.id.length > 0,
            )
            .map(mapRecording),
          score: rawResult.score ?? 0,
        }))
        .toSorted(
          (firstMatch, secondMatch) =>
            secondMatch.score - firstMatch.score ||
            firstMatch.acoustId.localeCompare(
              secondMatch.acoustId,
            ),
        )
    : (() => {
        throw new Error(
          `AcoustID error ${rawResponse.error?.code ?? "?"}: ${
            rawResponse.error?.message ?? "unknown error"
          }${
            rawResponse.error?.code ===
            ACOUSTID_INVALID_API_KEY_ERROR_CODE
              ? " — ACOUSTID_API_KEY must be the APPLICATION key, not the account key from your AcoustID user page."
              : ""
          }`,
        )
      })()

// The duration AcoustID compares against is a whole number of seconds.
// Sending `183.24` is rejected as a bad parameter.
export const buildAcoustIdLookupBody = ({
  apiKey,
  durationSeconds,
  fingerprint,
}: {
  apiKey: string
  durationSeconds: number
  fingerprint: string
}) =>
  new URLSearchParams({
    client: apiKey,
    duration: String(Math.round(durationSeconds)),
    fingerprint,
    meta: ACOUSTID_LOOKUP_META.join(" "),
  }).toString()

// The fingerprint is a few kilobytes, which is why this is a POST rather
// than the GET the documentation's examples use — a long fingerprint in a
// query string hits proxy URL limits. The provider cache is keyed on the
// URL, and every lookup posts to the SAME url, so the fingerprint has to
// travel as an explicit `cacheKey` or every track would read the first
// track's answer.
export const lookupAcoustId = ({
  apiKey = "",
  cachedFetch,
  durationSeconds,
  fingerprint,
}: {
  apiKey?: string
  cachedFetch: CachedFetch
  durationSeconds: number
  fingerprint: string
}): Observable<AcoustIdMatch[]> =>
  from(
    cachedFetch(ACOUSTID_LOOKUP_URL, {
      body: buildAcoustIdLookupBody({
        apiKey: apiKey || requireAcoustIdApiKey(),
        durationSeconds,
        fingerprint,
      }),
      cacheKey: `${ACOUSTID_LOOKUP_URL}#${Math.round(
        durationSeconds,
      )}:${fingerprint}`,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    }),
  ).pipe(
    map(({ body }) =>
      mapAcoustIdResponse(
        JSON.parse(body) as AcoustIdRawLookupResponse,
      ),
    ),
    logAndRethrowPipelineError(lookupAcoustId),
  )
