import { logAndRethrowPipelineError } from "@mux-magic/tools"
import { defer, map, type Observable } from "rxjs"

import {
  MUSICBRAINZ_BASE_URL,
  requireMusicBrainzUserAgent,
} from "./musicBrainzApi.js"

// Phase 9, the MusicBrainz half of writing back.
//
// ⚠️ Read this before adding anything here. The web service accepts FIVE
// submissions and no more:
//
//   tags and genres   POST /ws/2/tag
//   ratings           POST /ws/2/rating
//   barcodes          POST /ws/2/release/
//   ISRCs             POST /ws/2/recording/
//   collections       PUT|DELETE /ws/2/collection/<gid>/<entity-type>
//
// It **cannot create or edit a release, a recording or an artist.** That
// is not a gap in this client, it is the documented shape of the API —
// the documentation says to use the website for most additions. So "fix
// this release's track title from the tagger" is not an API call and
// never will be. The missing half is `buildSeededReleaseForm` below.

// Every submission carries `client=<application-version>`, separate from
// the User-Agent. MusicBrainz rejects a submission without it.
export const MUSICBRAINZ_CLIENT_ID_PARAMETER =
  "mux-magic-1.0.0"

export const MUSICBRAINZ_OAUTH_TOKEN_URL =
  "https://musicbrainz.org/oauth2/token"

// The release editor is a WEB form, not an endpoint. A seed passed as
// query parameters is ignored — this was tried and the editor opened
// completely empty. It reads its seed from an HTML form POST body.
export const MUSICBRAINZ_RELEASE_ADD_URL =
  "https://musicbrainz.org/release/add"

export type MusicBrainzSubmissionKind =
  | "barcode"
  | "isrc"
  | "rating"
  | "tag"

const escapeXml = (text: string) =>
  text
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;")

const wrapMetadata = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><metadata xmlns="http://musicbrainz.org/ns/mmd-2.0#">${inner}</metadata>`

export const buildTagSubmissionBody = (
  taggedRecordings: {
    recordingId: string
    tags: string[]
  }[],
) =>
  wrapMetadata(
    `<recording-list>${taggedRecordings
      .map(
        ({ recordingId, tags }) =>
          `<recording id="${escapeXml(recordingId)}"><user-tag-list>${tags
            .map(
              (tag) =>
                `<user-tag><name>${escapeXml(tag)}</name></user-tag>`,
            )
            .join("")}</user-tag-list></recording>`,
      )
      .join("")}</recording-list>`,
  )

// MusicBrainz stores a rating out of 100 and shows it as five stars, so
// a whole star is 20. Sending 4 rather than 80 quietly files a
// one-fifth-of-a-star rating.
export const MUSICBRAINZ_RATING_PER_STAR = 20

export const buildRatingSubmissionBody = (
  ratedRecordings: {
    recordingId: string
    stars: number
  }[],
) =>
  wrapMetadata(
    `<recording-list>${ratedRecordings
      .map(
        ({ recordingId, stars }) =>
          `<recording id="${escapeXml(recordingId)}"><user-rating>${
            stars * MUSICBRAINZ_RATING_PER_STAR
          }</user-rating></recording>`,
      )
      .join("")}</recording-list>`,
  )

export const buildBarcodeSubmissionBody = (
  barcodedReleases: {
    barcode: string
    releaseId: string
  }[],
) =>
  wrapMetadata(
    `<release-list>${barcodedReleases
      .map(
        ({ barcode, releaseId }) =>
          `<release id="${escapeXml(releaseId)}"><barcode>${escapeXml(
            barcode,
          )}</barcode></release>`,
      )
      .join("")}</release-list>`,
  )

export const buildIsrcSubmissionBody = (
  isrcRecordings: {
    isrcs: string[]
    recordingId: string
  }[],
) =>
  wrapMetadata(
    `<recording-list>${isrcRecordings
      .map(
        ({ isrcs, recordingId }) =>
          `<recording id="${escapeXml(recordingId)}"><isrc-list count="${
            isrcs.length
          }">${isrcs
            .map(
              (isrc) => `<isrc id="${escapeXml(isrc)}"/>`,
            )
            .join("")}</isrc-list></recording>`,
      )
      .join("")}</recording-list>`,
  )

const SUBMISSION_PATHS: Record<
  MusicBrainzSubmissionKind,
  string
> = {
  barcode: "/release/",
  isrc: "/recording/",
  rating: "/rating",
  tag: "/tag",
}

export const buildSubmissionUrl = (
  kind: MusicBrainzSubmissionKind,
) =>
  `${MUSICBRAINZ_BASE_URL}${SUBMISSION_PATHS[kind]}?client=${encodeURIComponent(
    MUSICBRAINZ_CLIENT_ID_PARAMETER,
  )}`

const throwMissingAccessToken = (): never => {
  throw new Error(
    "No MusicBrainz OAuth access token. A submission is an edit on the owner's account, so it needs a token obtained through the OAuth flow with MUSICBRAINZ_OAUTH_CLIENT_ID and MUSICBRAINZ_OAUTH_CLIENT_SECRET. An unauthenticated submission is rejected with 401.",
  )
}

// ⚠️ Never routed through the provider cache. A cache exists to avoid
// repeating a request; a submission is the one request that must never
// be replayed from a stored answer, and caching a 200 would make a retry
// report success without sending anything.
export const submitToMusicBrainz = ({
  accessToken,
  body,
  fetchImplementation = globalThis.fetch,
  kind,
}: {
  accessToken: string
  body: string
  fetchImplementation?: typeof globalThis.fetch
  kind: MusicBrainzSubmissionKind
}): Observable<{ isOk: true }> =>
  // `defer`, not `from`, so a missing token becomes a stream ERROR
  // rather than a synchronous throw out of this function. Everything
  // downstream handles a failed observable; a synchronous throw escapes
  // the pipeline and takes the job's error handling with it.
  defer(() =>
    fetchImplementation(buildSubmissionUrl(kind), {
      body,
      headers: {
        Authorization: `Bearer ${
          accessToken || throwMissingAccessToken()
        }`,
        "Content-Type": "application/xml; charset=utf-8",
        "User-Agent": requireMusicBrainzUserAgent(),
      },
      method: "POST",
    })
      .then((response) =>
        response.text().then((responseBody) => ({
          response,
          responseBody,
        })),
      )
      .then(({ response, responseBody }) =>
        response.ok
          ? { isOk: true as const }
          : Promise.reject(
              new Error(
                `MusicBrainz ${kind} submission failed: ${response.status} ${
                  response.statusText
                } ${responseBody.slice(0, 300)}`,
              ),
            ),
      ),
  ).pipe(
    map((outcome) => outcome),
    logAndRethrowPipelineError(submitToMusicBrainz),
  )

// ── The half that is not an API at all ──────────────────────────────

export type SeededReleaseTrack = {
  lengthMilliseconds: number
  title: string
  trackNumber: number
}

export type SeededRelease = {
  albumArtistName: string
  artistMbid?: string
  countryCode?: string
  date?: string
  editNote?: string
  label?: string
  languageCode?: string
  packaging?: string
  mediumFormat?: string
  primaryType?: string
  releaseTitle: string
  scriptCode?: string
  secondaryTypes?: string[]
  status?: string
  tracks: SeededReleaseTrack[]
  url?: string
}

// Defaults for a digital release, which is the case that actually blocks
// ingest — an indie or Bandcamp album MusicBrainz has never heard of.
const SEED_DEFAULTS = {
  countryCode: "XW",
  languageCode: "eng",
  mediumFormat: "Digital Media",
  packaging: "None",
  primaryType: "Album",
  scriptCode: "Latn",
  status: "Official",
}

const buildDateEntries = (
  date: string | undefined,
): [string, string][] =>
  date === undefined || date.length === 0
    ? []
    : ((parts: string[]) =>
        (
          [
            ["events.0.date.year", parts[0]],
            [
              "events.0.date.month",
              parts[1] === undefined
                ? undefined
                : String(Number(parts[1])),
            ],
            [
              "events.0.date.day",
              parts[2] === undefined
                ? undefined
                : String(Number(parts[2])),
            ],
          ] as [string, string | undefined][]
        ).filter(
          (entry): entry is [string, string] =>
            entry[1] !== undefined,
        ))(date.split("-"))

// An ORDERED list of pairs, not an object. The release editor reads the
// primary type and each secondary type as REPEATED `type` inputs, and a
// plain object can hold only one.
export const buildSeededReleaseFields = (
  release: SeededRelease,
): [string, string][] =>
  (
    [
      ["name", release.releaseTitle],
      [
        "artist_credit.names.0.name",
        release.albumArtistName,
      ],
      ...(release.artistMbid === undefined
        ? []
        : ([
            [
              "artist_credit.names.0.mbid",
              release.artistMbid,
            ],
          ] as [string, string][])),
      [
        "type",
        release.primaryType ?? SEED_DEFAULTS.primaryType,
      ],
      ...(release.secondaryTypes ?? []).map(
        (secondaryType): [string, string] => [
          "type",
          secondaryType,
        ],
      ),
      ["status", release.status ?? SEED_DEFAULTS.status],
      [
        "packaging",
        release.packaging ?? SEED_DEFAULTS.packaging,
      ],
      [
        "language",
        release.languageCode ?? SEED_DEFAULTS.languageCode,
      ],
      [
        "script",
        release.scriptCode ?? SEED_DEFAULTS.scriptCode,
      ],
      [
        "mediums.0.format",
        release.mediumFormat ?? SEED_DEFAULTS.mediumFormat,
      ],
      [
        "events.0.country",
        release.countryCode ?? SEED_DEFAULTS.countryCode,
      ],
    ] as [string, string][]
  )
    .concat(buildDateEntries(release.date))
    .concat(
      release.label === undefined
        ? []
        : [["labels.0.name", release.label]],
    )
    .concat(
      release.url === undefined
        ? []
        : [["urls.0.url", release.url]],
    )
    .concat([
      [
        "edit_note",
        release.editNote ??
          "Track titles, order and lengths taken from the purchased audio download.",
      ],
    ])
    .concat(
      release.tracks.flatMap(
        (track, trackIndex): [string, string][] => [
          [
            `mediums.0.track.${trackIndex}.name`,
            track.title,
          ],
          [
            `mediums.0.track.${trackIndex}.number`,
            String(track.trackNumber),
          ],
          [
            `mediums.0.track.${trackIndex}.length`,
            String(Math.round(track.lengthMilliseconds)),
          ],
        ],
      ),
    )

// A self-submitting HTML form, ported rather than re-derived — the
// working version has been in the private workspace since July 2026 and
// has added a real release.
//
// ⚠️ Two things that cost a round trip the first time:
//   1. A seed in the QUERY STRING is ignored. The editor opens empty.
//      The seed has to arrive as a form POST body.
//   2. Opening the editor saves NOTHING. The green "Enter edit" button
//      at the bottom is what creates the release, so the page below says
//      so rather than leaving the user thinking the job is done.
export const buildSeededReleaseForm = (
  release: SeededRelease,
) =>
  ((fields: [string, string][]) =>
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Add ${escapeXml(
      release.releaseTitle,
    )} to MusicBrainz</title></head>
<body style="font-family:sans-serif;padding:2em;max-width:640px">
<h2>Sending &ldquo;${escapeXml(
      release.releaseTitle,
    )}&rdquo; to the MusicBrainz release editor&hellip;</h2>
<p>Make sure you are <b>logged in to MusicBrainz</b> in this browser first.
If the editor does not open by itself, use the button. After it opens, step through
the tabs and click the green <b>&ldquo;Enter edit&rdquo;</b> at the bottom to create the
release. Opening the editor on its own saves nothing.</p>
<form id="mux-magic-seed" method="POST" action="${MUSICBRAINZ_RELEASE_ADD_URL}" accept-charset="UTF-8">
${fields
  .map(
    ([name, value]) =>
      `  <input type="hidden" name="${escapeXml(
        name,
      )}" value="${escapeXml(value)}">`,
  )
  .join("\n")}
  <button type="submit" style="font-size:1.1em;padding:.6em 1.2em">Open MusicBrainz release editor</button>
</form>
<script>document.getElementById('mux-magic-seed').submit();</script>
</body></html>
`)(buildSeededReleaseFields(release))

// ── OAuth ───────────────────────────────────────────────────────────
//
// A submission is an edit on the owner's MusicBrainz account, so it
// needs a user token — the application credentials alone do not grant
// one. Verified against the live service on 2026-08-25: all four
// submission endpoints answer **401** to an unauthenticated POST, and
// authorisation is checked before the `client` parameter is, so a
// missing token is the first thing that fails.
//
// The interactive half of the flow (sending the owner to
// `musicbrainz.org/oauth2/authorize` and catching the redirect) belongs
// to whatever surface asks for the token. This function is only the
// exchange, so it can be tested without a browser.

export type MusicBrainzOAuthToken = {
  accessToken: string
  expiresInSeconds: number
  refreshToken: string | null
}

type MusicBrainzRawTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
  expires_in?: number
  refresh_token?: string | null
}

// Picard asks for exactly these. `tag` covers tags and genres, `rating`
// covers ratings, and `submit_isrc` / `submit_barcode` cover the two
// entity submissions. Nothing here needs `profile` or `email`.
export const MUSICBRAINZ_OAUTH_SCOPES = [
  "tag",
  "rating",
  "submit_isrc",
  "submit_barcode",
]

export const buildMusicBrainzAuthorizeUrl = ({
  clientId,
  redirectUri,
}: {
  clientId: string
  redirectUri: string
}) =>
  `https://musicbrainz.org/oauth2/authorize?${new URLSearchParams(
    {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: MUSICBRAINZ_OAUTH_SCOPES.join(" "),
    },
  ).toString()}`

export const exchangeMusicBrainzAuthorizationCode = ({
  authorizationCode,
  clientId,
  clientSecret,
  fetchImplementation = globalThis.fetch,
  redirectUri,
}: {
  authorizationCode: string
  clientId: string
  clientSecret: string
  fetchImplementation?: typeof globalThis.fetch
  redirectUri: string
}): Observable<MusicBrainzOAuthToken> =>
  defer(() =>
    fetchImplementation(MUSICBRAINZ_OAUTH_TOKEN_URL, {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": requireMusicBrainzUserAgent(),
      },
      method: "POST",
    })
      .then((response) => response.text())
      .then(
        (body) =>
          JSON.parse(body) as MusicBrainzRawTokenResponse,
      )
      .then((rawToken) =>
        typeof rawToken.access_token === "string" &&
        rawToken.access_token.length > 0
          ? {
              accessToken: rawToken.access_token,
              expiresInSeconds: rawToken.expires_in ?? 0,
              refreshToken: rawToken.refresh_token ?? null,
            }
          : Promise.reject(
              new Error(
                `MusicBrainz OAuth exchange failed: ${
                  rawToken.error ?? "unknown error"
                }${
                  rawToken.error_description === undefined
                    ? ""
                    : ` — ${rawToken.error_description}`
                }`,
              ),
            ),
      ),
  ).pipe(
    map((token) => token),
    logAndRethrowPipelineError(
      exchangeMusicBrainzAuthorizationCode,
    ),
  )
