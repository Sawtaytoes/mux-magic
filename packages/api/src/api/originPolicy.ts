import type { MiddlewareHandler } from "hono"

// Which browser origins may call the API. The web UI is served by the
// same front-door server as /api, so its requests are same-origin. Other
// origins are allowed only when the operator lists them.
//
//   - Same host: the Origin's host equals the request's Host header (or
//     X-Forwarded-Host behind a reverse proxy). The scheme is not
//     compared, because a proxy that ends TLS forwards plain http.
//   - PUBLIC_URL: the origin of the app's public URL, when it is set.
//   - CORS_ALLOWED_ORIGINS: a comma-separated list of extra origins.
//
// A request with no Origin header (curl, Home Assistant, server-side
// clients) is not a browser cross-origin request, so it is not limited.

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

const getRequestHosts = (headers: Headers) =>
  [headers.get("host"), headers.get("x-forwarded-host")]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)

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
  (getRequestHosts(headers).includes(
    toHost(origin) ?? "",
  ) ||
    isConfiguredOrigin(origin))

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// CORS response headers only stop a browser from READING a response.
// A cross-site page can still SEND a simple POST (a form, or a fetch
// with a text/plain body), and the server would run it. This guard
// refuses any state-changing request whose Origin is not allowed, so
// another site cannot start a job or delete a file through the
// operator's browser.
export const crossOriginWriteGuard: MiddlewareHandler =
  async (context, next) => {
    const origin = context.req.header("origin")
    if (
      origin !== undefined &&
      !SAFE_METHODS.has(context.req.method) &&
      !isAllowedOrigin({
        headers: context.req.raw.headers,
        origin,
      })
    ) {
      return context.json(
        {
          error: "cross-origin request refused",
          details: `Origin ${origin} is not allowed. Add it to CORS_ALLOWED_ORIGINS to allow it.`,
        },
        403,
      )
    }
    await next()
  }
