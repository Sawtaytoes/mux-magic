import { readFile, stat } from "node:fs/promises"
import { join } from "node:path"

import type { DecodeResponseBody } from "../provider-cache/cachedFetch.js"
import { markProviderUnreachable } from "../provider-cache/networkFirst.js"
import type { ProviderCache } from "../provider-cache/providerCache.js"
import { buildSharedProviderCacheRead } from "../provider-cache/providerCacheFallbacks.js"
import { getAnidbCacheDir } from "./getAnidbCacheDir.js"
import { getSharedProviderCache } from "./sharedProviderCache.js"
import { buildSharedCachedFetch } from "./sharedProviderFetchers.js"

export const ANIDB_PROVIDER = "aniDb"

// AniDB's published cap is 1 request per 2s. We pad by 0.5s to leave
// headroom. The provider cache's rate limiter is a promise chain, NOT a bare
// timestamp check: with a bare check, concurrent callers all read the same
// stale "last request" time, all compute "no wait", and all fire in the
// same tick — so a parallel sequence group containing several
// nameAnimeEpisodesAniDB steps would burst past the cap and earn a ban.
// Chaining makes each caller wait for the previous one's slot before
// claiming its own, so N concurrent lookups are spaced exactly like N
// sequential ones.
//
// In-process only. Across separate CLI invocations it is the stored answer
// in `provider-cache.sqlite` — served without a request for its first day,
// see PROVIDER_CACHE_POLICIES — that keeps us from asking twice.
export const MIN_REQUEST_INTERVAL_MS = 2_500

const ANIDB_REQUEST_TIMEOUT_MILLISECONDS = 20_000

// AniDB answers a failure with HTTP 200 and an `<error>` root (banned
// client, unknown aid, …). Rejecting here makes it a failed request: it is
// never stored, and a stored answer stands in for it. A ban additionally
// marks the provider unreachable, which stops every later AniDB read in
// the same job from asking again — asking a banning server again is how a
// ban gets longer.
const toAnidbError = ({
  responseUrl,
  xml,
}: {
  responseUrl: string
  xml: string
}) =>
  ((anidbError: Error) =>
    /banned/i.test(xml)
      ? markProviderUnreachable(anidbError)
      : anidbError)(
    new Error(
      `AniDB error for ${responseUrl}: ${xml.slice(0, 200)}`,
    ),
  )

const decodeAnidbResponse: DecodeResponseBody = (
  response,
) =>
  response.text().then((xml) =>
    xml.includes("<error")
      ? Promise.reject(
          toAnidbError({
            responseUrl: response.url,
            xml,
          }),
        )
      : xml,
  )

const anidbCachedFetch = buildSharedCachedFetch({
  decodeResponseBody: decodeAnidbResponse,
  minimumRequestIntervalMilliseconds:
    MIN_REQUEST_INTERVAL_MS,
  provider: ANIDB_PROVIDER,
  timeoutMilliseconds: ANIDB_REQUEST_TIMEOUT_MILLISECONDS,
})

// Node 18+ fetch auto-decodes Content-Encoding: gzip, so no manual gunzip.
export const buildAnidbAnimeUrl = ({
  aid,
  client,
  clientver,
}: {
  aid: number
  client: string
  clientver: string
}) =>
  "http://api.anidb.net:9001/httpapi"
    .concat(`?request=anime&aid=${aid}`)
    .concat(`&client=${encodeURIComponent(client)}`)
    .concat(`&clientver=${encodeURIComponent(clientver)}`)
    .concat("&protover=1")

// Until 2026-09-29 AniDB had its own cache: one XML file per anime under
// `getAnidbCacheDir()/anime`, served for 7 days. That directory is no
// longer written. A file there is still a real AniDB answer, so the first
// read of an aid the provider cache has never seen imports it with its
// file time. That keeps the one-day no-repeat rule honest across the
// upgrade, and keeps the file as the outage fallback.
const LEGACY_ANIME_DIRECTORY = join(
  getAnidbCacheDir(),
  "anime",
)

const importLegacyAnimeXml = ({
  aid,
  cache,
  requestKey,
}: {
  aid: number
  cache: ProviderCache
  requestKey: string
}) =>
  cache.getStale({
    provider: ANIDB_PROVIDER,
    requestKey,
  }) === null
    ? ((legacyPath: string) =>
        Promise.all([
          readFile(legacyPath, "utf8"),
          stat(legacyPath),
        ])
          .then(([xml, fileStats]) => {
            if (xml.includes("<error") === false) {
              cache.set({
                body: xml,
                fetchedAt: fileStats.mtimeMs,
                provider: ANIDB_PROVIDER,
                requestKey,
              })
            }
          })
          .catch(() => undefined))(
        join(LEGACY_ANIME_DIRECTORY, `${aid}.xml`),
      )
    : Promise.resolve()

// Concurrent lookups of the SAME aid collapse into one request: the
// second caller awaits the first's promise instead of racing it to the
// network. Cleared when it settles so a failure doesn't poison later
// retries.
const inFlightByAid = new Map<
  number,
  () => Promise<string>
>()

const fetchAnimeXml = ({
  aid,
  client,
  clientver,
}: {
  aid: number
  client: string
  clientver: string
}) =>
  ((url: string) =>
    importLegacyAnimeXml({
      aid,
      cache: getSharedProviderCache(),
      requestKey: url,
    })
      .then(() => anidbCachedFetch(url))
      .then(({ body }) => body))(
    buildAnidbAnimeUrl({ aid, client, clientver }),
  )

export const getAnimeXml = (
  aid: number,
  {
    client,
    clientver,
  }: { client: string; clientver: string },
) =>
  (
    inFlightByAid.get(aid) ??
    ((read: () => Promise<string>) =>
      inFlightByAid
        .set(aid, read)
        .get(aid) as () => Promise<string>)(
      buildSharedProviderCacheRead(() =>
        fetchAnimeXml({ aid, client, clientver }).finally(
          () => {
            inFlightByAid.delete(aid)
          },
        ),
      ),
    )
  )()
