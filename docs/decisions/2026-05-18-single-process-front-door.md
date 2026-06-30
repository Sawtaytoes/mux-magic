# 2026-05-18 — Single-process front-door; no WEB_PORT; never mutate index.html

- **Status:** Accepted
- **Date decided:** 2026-05-18
- **Area:** infra / web / server/api
- **Source:** worker 29, commits `59339689`, `94d7146c`, `ab7d17fe`; related `67e4dd8d` (dev proxy removal), `8c7357a2` / `62531e8c` (dev `--watch-path`)

## Decision

mux-magic runs as **one process on one port** (default `3000`). The `@mux-magic/server` front-door is a single Hono root: `/api/*` mounts the API sub-app in-process (no proxy), `/storybook/*` serves Storybook, `/*` serves the SPA (Vite middleware mode in dev for HMR over the same port; `serveStatic(packages/web/dist)` in prod). `node` is PID 1 in the container (signals via `docker run --init`). Dev auto-restart uses Node `--watch-path` with an explicit allowlist, **not** `tsx watch`.

## What we rejected — DO NOT revert to this

- **A second web server / `WEB_PORT`.** Deleted: `packages/web/src/server.ts`, `legacy-listener.ts`, `scripts/start-prod.cjs`. Dropped: `WEB_PORT`, `concurrently`, `wait-on`. `REMOTE_SERVER_URL` was renamed `PUBLIC_URL` (docs/OpenAPI-only). Do not "restore a separate dev web server" for convenience.
- **Mutating `index.html` at boot/request.** The server NEVER rewrites `packages/web/dist/index.html`; the `window.__API_BASE__` boot-injection was deleted. If injection is ever truly needed, do it via Hono response middleware — not by editing the file.
- **A Vite dev proxy allowlist.** Removed (`67e4dd8d`) — it silently fell through to `index.html` (HTML instead of JSON) whenever a path prefix was missing. Same-origin in-process mount replaced it.
- **`tsx watch` for dev restart.** Its restart loop was triggered by Vite's `.vite-temp/*.mjs` churn; `--watch-path` with an allowlist + dev-only SIGTERM shutdown is the fix. Don't "simplify" back to `tsx watch`.
- Route `path:` declarations use bare paths (`/templates`), never a hard-coded `/api` prefix — the front-door supplies the mount, and double-prefixing falls through to the SPA catch-all.

## Why it must not be re-litigated

This collapsed dev from 3 child processes to 1 and saved ~100 MB container RSS, and each removed piece (WEB_PORT, proxy, tsx watch, HTML injection) was a real recurring failure source. Restoring any of them re-introduces the exact bug it was deleted to fix.
