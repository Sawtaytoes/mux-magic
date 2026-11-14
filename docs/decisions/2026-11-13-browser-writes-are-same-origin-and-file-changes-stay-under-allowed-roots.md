# 2026-11-13 — Browser writes are same-origin, and file changes stay under the allowed roots

> [!WARNING]
> **SUPERSEDED IN PART on 2026-11-13 by [The API uses the shared Charcuterie write guard](2026-11-13-the-api-uses-the-shared-charcuterie-write-guard.md).**
> Only the write rule in the first bullet changed: the shared guard also checks `Host` against `ALLOWED_HOSTS` and asks a write for a JSON `Content-Type`, so a request with no `Origin` is no longer let through unchecked. Everything else below still holds.
>
> **ALSO SUPERSEDED IN PART on 2026-11-14 by [Core writes check every path against the allowed roots](2026-11-14-core-writes-check-every-path-against-the-allowed-roots.md).**
> Only the sentence in the fourth bullet that calls the command check "a check on the parameters, not a sandbox" changed: core's write primitives now check every path a command builds or finds, too.

- **Status:** Accepted; superseded in part by [2026-11-13](2026-11-13-the-api-uses-the-shared-charcuterie-write-guard.md) and [2026-11-14](2026-11-14-core-writes-check-every-path-against-the-allowed-roots.md)
- **Date:** 2026-11-13
- **Type:** server/api
- **Supersedes:** —
- **Superseded by:** [2026-11-13 — The API uses the shared Charcuterie write guard](2026-11-13-the-api-uses-the-shared-charcuterie-write-guard.md), in part; [2026-11-14 — Core writes check every path against the allowed roots](2026-11-14-core-writes-check-every-path-against-the-allowed-roots.md), in part
- **Source:** 2026-11-12 code audit (security findings); the owner asked for all of its findings to be fixed

## Decision

- The API sends CORS headers only to an allowed origin: the request's own host (compared by host, so a proxy that ends TLS still matches), the origin of `PUBLIC_URL`, or an entry in `CORS_ALLOWED_ORIGINS`. A state-changing request (anything but GET, HEAD, and OPTIONS) that carries any other `Origin` is refused with 403. A request with no `Origin` header, such as curl or Home Assistant, is not affected.
- `validateReadablePath` rejects a raw `..` segment before it normalizes the path.
- Routes that delete, rename, move, or write files call `validateWritablePath`, which also requires the path to be inside the allowed file roots: `ALLOWED_FILE_ROOTS` when set, `/media` in the container image, and no limit in a source installation. Symbolic links in the existing part of the path are resolved first, so a link inside a root cannot lead outside it. Deletes enforce it inside `deleteFiles`.
- `POST /commands/*` and every sequence step check their path parameters (`sourcePath`, `destinationPath`, `pathsToDelete`, and the others listed in `pathSafety.ts`) the same way before the command runs. `rootPath` is not checked, because it names the path a media player sees and need not exist here. This is a check on the parameters, not a sandbox: a path a command builds or finds later (the parent folder `flattenOutput` writes into, or a linked folder found while walking a tree) is not checked again. `renameFiles` refuses a regex result that leaves the file's folder.
- `POST /music/duplicates/resolve` checks the full holding destination, after the source-relative part is added, and moves the file with the no-replace `renameFileOrFolder`.
- The Origin check compares against the `Host` header only. `X-Forwarded-Host` is not trusted, because a client can set it; the reverse proxy passes `Host` through.

## Context

The audit found that CORS echoed any origin back, so any web page could read API responses through the operator's browser, and that the `..` check ran after `normalize`, which had already collapsed the traversal, so it never matched. `ALLOWED_DELETE_ROOTS` was named in route descriptions but never existed, so a delete or rename could reach any path the process could write.

## What we rejected — DO NOT revert to this

- **Reflecting the request's Origin in `Access-Control-Allow-Origin`.** The web UI is same-origin and does not need it.
- **CORS as the only cross-site protection.** CORS stops a page from reading a response, not from sending a simple POST. The write guard is what stops the request.
- **Checking for `..` after `normalize`.** The check must see the raw input.
- **Trusting `X-Forwarded-Host`.** A client can send it.
- **Limiting reads to the roots.** Browsing and reading stay unlimited, because the file explorer and the path pickers browse the whole host on a source installation.

## Why

The app deletes and renames media. A page on another site must not be able to make the operator's browser start a job or delete a file, and a request must not be able to change files outside the media mounts.

## Evidence

- Tests: `hono-routes.test.ts` (foreign origin gets no CORS header; cross-origin and `null`-origin writes get 403; same-origin and no-origin writes pass), `pathSafety.test.ts` (raw traversal rejected; roots default and override), and `fileRoutes.test.ts` (delete and rename outside `/media`, or through a symbolic link that leaves it, refused and the file kept), `commandRoutes.test.ts` and `sequenceRoutes.test.ts` (a `deleteFolder` or `moveFiles` outside the roots is refused and the files are kept).
- The deployed container mounts every media folder under `/media`, so the default needs no new setting.
