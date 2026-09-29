import createClient from "openapi-fetch"
import type { paths } from "../schema.generated/tvdbApiSchema.js"
import { buildSharedCachedFetch } from "./sharedProviderFetchers.js"

export const tvdbApiSchemaUrl =
  "https://thetvdb.github.io/v4-api/swagger.yml"
export const tvdbApiUrl = "https://api4.thetvdb.com/v4"

export const getTvdbApiUrl = (apiPath: string) =>
  tvdbApiUrl.concat(apiPath)

const TVDB_REQUEST_TIMEOUT_MILLISECONDS = 20_000

// TVDB publishes no per-client rate; a lookup is two or three requests.
const TVDB_MINIMUM_REQUEST_INTERVAL_MILLISECONDS = 250

// Network-first through `provider-cache.sqlite` under `tvdb`, keyed on the
// URL. The bearer token is a header, so it is neither part of the key nor
// stored.
const tvdbCachedFetch = buildSharedCachedFetch({
  minimumRequestIntervalMilliseconds:
    TVDB_MINIMUM_REQUEST_INTERVAL_MILLISECONDS,
  provider: "tvdb",
  timeoutMilliseconds: TVDB_REQUEST_TIMEOUT_MILLISECONDS,
})

const toJsonResponse = ({
  body,
  status,
}: {
  body: string
  status: number
}) =>
  new Response(body, {
    headers: { "Content-Type": "application/json" },
    status,
  })

// openapi-fetch hands its `fetch` a Request and wants a Response back, so
// the generated client stays unaware of the cache. A status error with
// nothing cached is handed back as that status, exactly as TVDB sent it —
// a missing English translation is a 404 the lookup expects and reads
// past. Only an unreachable TVDB with nothing cached rejects.
export const fetchTvdbThroughProviderCache = (
  request: Request,
) =>
  tvdbCachedFetch(request.url, {
    headers: Object.fromEntries(request.headers.entries()),
  }).then(
    ({ body }) => toJsonResponse({ body, status: 200 }),
    (thrownError: unknown) =>
      typeof (thrownError as { status?: unknown })
        .status === "number"
        ? toJsonResponse({
            body: "{}",
            status: (thrownError as { status: number })
              .status,
          })
        : Promise.reject(thrownError),
  )

// The login is a credential exchange, not a provider answer, so it is the
// one TVDB request that does NOT go through the cache — storing a bearer
// token in a disposable cache file is storing a credential. It is bounded,
// and a failed login is not fatal: the reads that follow go out without a
// token, fail, and fall back to their cached answers.
export const loginToTvdb = () =>
  createClient<paths>({
    baseUrl: tvdbApiUrl,
    fetch: (request) =>
      fetch(request, {
        signal: AbortSignal.timeout(
          TVDB_REQUEST_TIMEOUT_MILLISECONDS,
        ),
      }),
  })
    .POST("/login", {
      body: {
        apikey: process.env.TVDB_API_KEY ?? "",
        pin: "",
      },
    })
    .catch(() => ({ data: undefined }))

export const getTvdbFetchClient = () =>
  loginToTvdb().then(({ data }) =>
    createClient<paths>({
      baseUrl: tvdbApiUrl,
      fetch: fetchTvdbThroughProviderCache,
      headers: {
        Authorization: data?.data?.token || "",
      },
    }),
  )
