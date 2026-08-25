import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { defer, map, type Observable } from "rxjs"

import {
  ACOUSTID_INVALID_API_KEY_ERROR_CODE,
  requireAcoustIdApiKey,
} from "./acoustIdApi.js"
// Phase 9, the first and most useful write-back: send fingerprints to
// AcoustID.
//
// This is the one outward write that improves the database the tagger
// reads FROM. Every correctly-matched file is a free contribution, and
// Picard does exactly this by default (`save_acoustid_fingerprints`).
//
// ⚠️ It is never automatic. These are public database entries made under
// the owner's account, so a submission only happens from an explicit,
// reviewed action — the same shape as the tag table's Apply.

export const ACOUSTID_SUBMIT_URL =
  "https://api.acoustid.org/v2/submit"

// AcoustID accepts a batch of submissions in one request, indexed by a
// suffix on each parameter name (`duration.0`, `fingerprint.0`, …).
// Keeping the batch small keeps a partial failure readable.
export const ACOUSTID_SUBMIT_BATCH_SIZE = 10

// ⚠️ The two keys are NOT interchangeable, verified against the live API
// on 2026-08-25 by sending them BOTH ways round:
//
//   client=<application key>, user=<account key>  → gets past key
//     validation to the parameter check ("missing required parameter
//     \"fingerprint\"", error 2)
//   client=<account key>,     user=<application key>  → error 4,
//     "invalid API key"
//
// So `client` is the APPLICATION key from acoustid.org/new-application,
// and `user` is the ACCOUNT key from the AcoustID user page. Only the
// account key authorises a submission — the application key alone
// identifies the software.
const throwMissingUserApiKey = (): never => {
  throw new Error(
    "ACOUSTID_USER_API_KEY is not set. A fingerprint submission is made under your AcoustID ACCOUNT, so it needs the account key from https://acoustid.org/api-key — not the application key in ACOUSTID_API_KEY. Sending the application key as `user` fails.",
  )
}

export const requireAcoustIdUserApiKey = () =>
  process.env.ACOUSTID_USER_API_KEY ||
  throwMissingUserApiKey()

export type AcoustIdSubmission = {
  albumArtistName?: string
  albumName?: string
  artistName?: string
  durationSeconds: number
  fingerprint: string
  musicBrainzRecordingId?: string
  title?: string
  trackNumber?: number
  year?: number
}

export type AcoustIdSubmitResult = {
  submissionId: number
  status: string
}

type AcoustIdRawSubmitResponse = {
  error?: { code?: number; message?: string }
  status?: string
  submissions?: { id?: number; status?: string }[]
}

// The indexed parameter set for one submission. Every optional field is
// omitted rather than sent empty — an empty `track` would submit a blank
// title against the fingerprint, which is worse than sending nothing.
const buildSubmissionEntries = ({
  index,
  submission,
}: {
  index: number
  submission: AcoustIdSubmission
}): [string, string][] =>
  (
    [
      [
        "duration",
        String(Math.round(submission.durationSeconds)),
      ],
      ["fingerprint", submission.fingerprint],
      ["mbid", submission.musicBrainzRecordingId],
      ["track", submission.title],
      ["artist", submission.artistName],
      ["album", submission.albumName],
      ["albumartist", submission.albumArtistName],
      [
        "trackno",
        submission.trackNumber === undefined
          ? undefined
          : String(submission.trackNumber),
      ],
      [
        "year",
        submission.year === undefined
          ? undefined
          : String(submission.year),
      ],
    ] as [string, string | undefined][]
  )
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].length > 0,
    )
    .map(([name, value]) => [`${name}.${index}`, value])

export const buildAcoustIdSubmitBody = ({
  apiKey,
  submissions,
  userApiKey,
}: {
  apiKey: string
  submissions: AcoustIdSubmission[]
  userApiKey: string
}) =>
  new URLSearchParams(
    (
      [
        ["client", apiKey],
        ["user", userApiKey],
      ] as [string, string][]
    ).concat(
      submissions.flatMap((submission, index) =>
        buildSubmissionEntries({ index, submission }),
      ),
    ),
  ).toString()

export const mapAcoustIdSubmitResponse = (
  rawResponse: AcoustIdRawSubmitResponse,
): AcoustIdSubmitResult[] =>
  rawResponse.status === "ok"
    ? (rawResponse.submissions ?? []).map(
        (rawSubmission) => ({
          status: rawSubmission.status ?? "unknown",
          submissionId: rawSubmission.id ?? 0,
        }),
      )
    : (() => {
        throw new Error(
          `AcoustID submission error ${
            rawResponse.error?.code ?? "?"
          }: ${
            rawResponse.error?.message ?? "unknown error"
          }${
            rawResponse.error?.code ===
            ACOUSTID_INVALID_API_KEY_ERROR_CODE
              ? " — `user` must be the ACCOUNT key from your AcoustID user page and `client` the APPLICATION key. Swapping them returns exactly this error."
              : ""
          }`,
        )
      })()

// ⚠️ Not routed through the provider CACHE, unlike every read in this
// codebase. A cache exists to avoid repeating a request; a submission is
// the one request that must never be replayed from a stored answer, and
// caching a 200 would make a retry silently report success without
// sending anything.
export const submitAcoustIdFingerprints = ({
  apiKey = "",
  fetchImplementation = globalThis.fetch,
  submissions,
  userApiKey = "",
}: {
  apiKey?: string
  fetchImplementation?: typeof globalThis.fetch
  submissions: AcoustIdSubmission[]
  userApiKey?: string
}): Observable<AcoustIdSubmitResult[]> =>
  // `defer`, not `from`, so a missing key becomes a stream ERROR rather
  // than a synchronous throw out of this function. Everything downstream
  // handles a failed observable; a synchronous throw escapes it.
  defer(() =>
    submissions.length === 0
      ? Promise.resolve<AcoustIdSubmitResult[]>([])
      : fetchImplementation(ACOUSTID_SUBMIT_URL, {
          body: buildAcoustIdSubmitBody({
            apiKey: apiKey || requireAcoustIdApiKey(),
            submissions,
            userApiKey:
              userApiKey || requireAcoustIdUserApiKey(),
          }),
          headers: {
            Accept: "application/json",
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          method: "POST",
        })
          .then((response) => response.text())
          .then((body) =>
            mapAcoustIdSubmitResponse(
              JSON.parse(body) as AcoustIdRawSubmitResponse,
            ),
          ),
  ).pipe(
    map((results) => results),
    logAndRethrowPipelineError(submitAcoustIdFingerprints),
  )

// Exported so a caller does not have to know the batch size to stay
// inside it. AcoustID takes a batch in one request; a 200-track library
// pass in one body is neither polite nor debuggable.
export const chunkAcoustIdSubmissions = ({
  batchSize = ACOUSTID_SUBMIT_BATCH_SIZE,
  submissions,
}: {
  batchSize?: number
  submissions: AcoustIdSubmission[]
}): AcoustIdSubmission[][] =>
  Array.from(
    { length: Math.ceil(submissions.length / batchSize) },
    (_unused, batchIndex) =>
      submissions.slice(
        batchIndex * batchSize,
        batchIndex * batchSize + batchSize,
      ),
  )
