# 2026-11-13 — The API uses the shared Charcuterie write guard

- **Status:** Accepted
- **Date:** 2026-11-13
- **Type:** server/api
- **Supersedes:** [2026-11-13 — Browser writes are same-origin, and file changes stay under the allowed roots](2026-11-13-browser-writes-are-same-origin-and-file-changes-stay-under-allowed-roots.md), in part: only the write rule in its first bullet, which let any request with no `Origin` header through
- **Superseded by:** —
- **Source:** 2026-11-12 code audit (security findings); the Charcuterie decision "An app's API refuses cross-site writes with the shared write guard"

## Decision

The API mounts `createWriteGuard` from `@charcuterie/server` ahead of every route, in place of the hand-written `crossOriginWriteGuard`. `originPolicy.ts` builds its options on each request:

- `allowedHosts` comes from `ALLOWED_HOSTS`, a comma-separated list of the host names the server answers to (`media.example.com`, `192.0.2.10:3000`). Loopback is always allowed. With a list, a request on any other `Host` gets `421`, reads included.
- With an empty list, reads pass, and a write from a non-loopback `Host` gets `421` that names `ALLOWED_HOSTS`. Only `NODE_ENV=development` or `NODE_ENV=test` may write with an empty list. An unset `NODE_ENV` fails closed, because the production bundle runs as production without it: `packages/server` detects production from the bundle's `dist` folder.
- `allowedOrigins` is the origin of `PUBLIC_URL` plus `CORS_ALLOWED_ORIGINS`, the same list that receives CORS headers.
- A write must send `Content-Type: application/json`. A bodiless `POST` also passes with a same-origin `Origin` or `Sec-Fetch-Site`. `curl -X POST` with no body and no `Content-Type` gets `415`. Add `-H 'Content-Type: application/json'`.

CORS headers, the `..` check, and the allowed file roots are unchanged.

## Context

The audit's CORS finding was fixed with a mux-magic guard that compared `Origin` with `Host`. It had no `Host` allowlist, so a DNS-rebinding page, which is same-origin with the app, could still write. The same audit found five hand-written guards in other apps that had drifted apart. Charcuterie now exports one guard, and its decision says every fleet app with a state-changing API mounts it.

## What we rejected — DO NOT revert to this

- **Keeping a guard of our own.** It already lacked the `Host` check, and each app's copy had changed a rule without a reason.
- **Letting an empty `ALLOWED_HOSTS` allow writes in production.** A lost setting would silently turn the rebinding defense off.
- **Keying the empty-list exception on `NODE_ENV !== "production"`**, as the Charcuterie example does. `pnpm prod:server` runs the bundle with no `NODE_ENV`, so that rule would let a rebinding page write there.
- **Adding `PUBLIC_URL`'s host to `ALLOWED_HOSTS` automatically.** A list makes every other host get `421`, reads included. A setting that only names the documentation URL must not lock out a LAN address.
- **Accepting a `text/plain` body because it parses as JSON.** A cross-site page can send `text/plain` without a preflight.

## Why

The app deletes, renames, and moves media. A page in the operator's browser, including one reached through a rebinding host name, must not be able to start a job or change files. One shared guard, tested once in Charcuterie, cannot drift.

## Evidence

- `hono-routes.test.ts`: a `Host` outside `ALLOWED_HOSTS` gets `421` for a read; a rebinding write whose `Origin` matches its `Host` gets `421`; a production write with an empty list gets `421`, while a read and a loopback write still pass; a `text/plain` write and a bare bodiless `POST` get `415`; a bodiless `POST` with a JSON `Content-Type` passes. Six of the first set fail against the previous guard.
- The web UI sends `Content-Type: application/json` on every write with a body. Its bodiless `POST`s, such as error redelivery, pass because the browser sends a same-origin `Origin` and `Sec-Fetch-Site`. The e2e redelivery test, which uses Playwright's API client and sends neither, now sends the JSON type.
- A test with `NODE_ENV` unset and an empty list refuses a rebinding write with `421`.
