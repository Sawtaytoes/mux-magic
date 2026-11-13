# 2026-11-13 — Browser writes are same-origin, and file changes stay under the allowed roots

- **Status:** Accepted
- **Date:** 2026-11-13
- **Type:** server/api
- **Supersedes:** —
- **Superseded by:** —
- **Source:** 2026-11-12 code audit (security findings); the owner asked for all of its findings to be fixed

## Decision

- The API sends CORS headers only to an allowed origin: the request's own host (compared by host, so a proxy that ends TLS still matches), the origin of `PUBLIC_URL`, or an entry in `CORS_ALLOWED_ORIGINS`. A state-changing request (anything but GET, HEAD, and OPTIONS) that carries any other `Origin` is refused with 403. A request with no `Origin` header, such as curl or Home Assistant, is not affected.
- `validateReadablePath` rejects a raw `..` segment before it normalizes the path.
- Routes that delete, rename, move, or write files call `validateWritablePath`, which also requires the path to be inside the allowed file roots: `ALLOWED_FILE_ROOTS` when set, `/media` in the container image, and no limit in a source installation. Deletes enforce it inside `deleteFiles`, so the delete commands get it too.

## Context

The audit found that CORS echoed any origin back, so any web page could read API responses through the operator's browser, and that the `..` check ran after `normalize`, which had already collapsed the traversal, so it never matched. `ALLOWED_DELETE_ROOTS` was named in route descriptions but never existed, so a delete or rename could reach any path the process could write.

## What we rejected — DO NOT revert to this

- **Reflecting the request's Origin in `Access-Control-Allow-Origin`.** The web UI is same-origin and does not need it.
- **CORS as the only cross-site protection.** CORS stops a page from reading a response, not from sending a simple POST. The write guard is what stops the request.
- **Checking for `..` after `normalize`.** The check must see the raw input.
- **Limiting reads to the roots.** Browsing and reading stay unlimited, because the file explorer and the path pickers browse the whole host on a source installation.

## Why

The app deletes and renames media. A page on another site must not be able to make the operator's browser start a job or delete a file, and a request must not be able to change files outside the media mounts.

## Evidence

- Tests: `hono-routes.test.ts` (foreign origin gets no CORS header; cross-origin and `null`-origin writes get 403; same-origin and no-origin writes pass), `pathSafety.test.ts` (raw traversal rejected; roots default and override), and `fileRoutes.test.ts` (delete and rename outside `/media` refused, file kept).
- The deployed container mounts every media folder under `/media`, so the default needs no new setting.
