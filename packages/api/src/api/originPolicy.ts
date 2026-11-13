import {
  createWriteGuard,
  parseHostList,
  type WriteGuardOptions,
} from "@charcuterie/server"
import type { MiddlewareHandler } from "hono"

// Which browser origins may call the API. The web UI is served by the
// same front-door server as /api, so its requests are same-origin. Other
// origins are allowed only when the operator lists them.
//
//   - Same host: the Origin's host equals the request's Host header. The
//     reverse proxy passes Host through unchanged. The scheme is not
//     compared, because a proxy that ends TLS forwards plain http.
//     X-Forwarded-Host is not trusted, because a client can set it.
//   - PUBLIC_URL: the origin of the app's public URL, when it is set.
//   - CORS_ALLOWED_ORIGINS: a comma-separated list of extra origins.
//
// A request with no Origin header (curl, Home Assistant, server-side
// clients) is not a browser cross-origin request, so the origin rules do
// not limit it. The write guard below still checks its Host and asks a
// write for a JSON Content-Type.

const toOrigin = (url: string) => {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

const toHost = (url: string) => {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return null
  }
}

const getConfiguredOrigins = () =>
  (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .concat(process.env.PUBLIC_URL ?? "")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map(toOrigin)
    .filter((origin) => origin !== null)

const getRequestHost = (headers: Headers) =>
  (headers.get("host") ?? "").trim().toLowerCase()

const isConfiguredOrigin = (origin: string) =>
  getConfiguredOrigins().some(
    (configuredOrigin) =>
      configuredOrigin === toOrigin(origin),
  )

export const isAllowedOrigin = ({
  headers,
  origin,
}: {
  headers: Headers
  origin: string
}) =>
  toHost(origin) !== null &&
  (toHost(origin) === getRequestHost(headers) ||
    isConfiguredOrigin(origin))

// CORS response headers only stop a browser from READING a response.
// A cross-site page can still SEND a simple POST (a form, or a fetch
// with a text/plain body), and a DNS-rebinding page is same-origin with
// the app. The shared Charcuterie write guard closes both paths:
//
//   - Host must be loopback or an ALLOWED_HOSTS entry. With a list, any
//     other Host gets 421, reads included. With an empty list, reads
//     pass, and in production (the image sets NODE_ENV=production) a
//     write from a non-loopback Host gets 421, so a lost setting fails
//     closed.
//   - A write's Origin must be the request's own host, PUBLIC_URL's
//     origin, or a CORS_ALLOWED_ORIGINS entry, and Sec-Fetch-Site must
//     be same-origin or none.
//   - A write must send Content-Type: application/json. A bodiless POST
//     also passes with a same-origin Origin or Sec-Fetch-Site.
//
// The options are read on each request, so a test can change the
// environment between requests.
export const getWriteGuardOptions =
  (): WriteGuardOptions => ({
    allowedHosts: parseHostList(process.env.ALLOWED_HOSTS),
    allowedOrigins: getConfiguredOrigins(),
    hostSettingName: "ALLOWED_HOSTS",
    isEmptyHostListWritable:
      process.env.NODE_ENV !== "production",
  })

export const apiWriteGuard: MiddlewareHandler = (
  context,
  next,
) => createWriteGuard(getWriteGuardOptions())(context, next)
