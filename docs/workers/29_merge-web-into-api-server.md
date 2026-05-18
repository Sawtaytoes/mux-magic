# Worker 29 — merge-web-into-api-server

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/29-merge-web-into-api-server`
**Worktree:** `.claude/worktrees/29_merge-web-into-api-server/`
**Phase:** 4
**Depends on:** —
**Parallel with:** any worker that doesn't touch [packages/server/src/api/hono-routes.ts](../../packages/server/src/api/hono-routes.ts), [packages/web/src/server.ts](../../packages/web/src/server.ts), [scripts/start-prod.cjs](../../scripts/start-prod.cjs), or the root [Dockerfile](../../Dockerfile).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

The production container still runs **two Node servers** for the deployed app: the API on `PORT` and a tiny Hono static-file server on `WEB_PORT`. The second process exists only to call `serveStatic({ root: "./dist" })` against the Vite SPA build — work the API process is already equipped to do (it's already a Hono app with `@hono/node-server`). The duplication costs a full Node baseline (~80–150 MB RSS) plus a duplicated Hono+@hono/node-server runtime in memory, with no functional benefit at the single-user / single-host deployment posture the project is designed for.

This worker collapses the two production servers into one:

1. **Mount the SPA static assets under the existing API `app`** in [packages/server/src/api/hono-routes.ts](../../packages/server/src/api/hono-routes.ts). Use Hono's `serveStatic` from `@hono/node-server/serve-static`. Mount it **last** (after every `app.route(...)` and `addDocRoutes(app)` call) so API routes take precedence and the SPA only catches unmatched paths.
2. **Preserve the SPA-fallback rewrite** from [packages/web/src/server.ts:35-38](../../packages/web/src/server.ts#L35-L38) — any path without a file extension should be rewritten to `/index.html` so client-side routing keeps working.
3. **Preserve the no-cache headers** for served files ([packages/web/src/server.ts:39-46](../../packages/web/src/server.ts#L39-L46)) — `Cache-Control: no-cache, no-store, must-revalidate` + `Pragma: no-cache`. The current behaviour exists so a redeploy doesn't leave stale assets in user browsers; carry it forward verbatim. The `onFound` hook on `serveStatic` is the right place.
4. **Resolve the static root relative to the bundle**, not cwd. The current web server reads `./dist/index.html` from its own cwd; once mounted in the API, cwd is the repo root, so `./packages/web/dist` is the right path. Better: compute it from `import.meta.url` so the bundle resolves correctly regardless of where it's launched from.
5. **Handle `REMOTE_SERVER_URL` injection.** [packages/web/src/server.ts:13-24](../../packages/web/src/server.ts#L13-L24) mutates `./dist/index.html` at boot to inject `window.__API_BASE__`. After the merge, the API process IS the API base — `window.__API_BASE__` only made sense when the SPA was hosted on a different origin than the API. Two acceptable resolutions:
   - **Drop the injection entirely** with a comment that the SPA now always co-hosts with the API. The frontend already falls back to relative URLs when `window.__API_BASE__` is unset.
   - **Keep the injection as a Hono middleware** that rewrites the served `index.html` response body when `REMOTE_SERVER_URL` is set. Don't mutate the on-disk file — that would change permanent state every boot.

   Pick whichever the maintainer prefers; the second is more flexible (no rebuild needed to flip back to a split-host deploy) but adds runtime cost on every `index.html` request. Default recommendation: drop the injection; restore it as a middleware only if a user surfaces a split-host need.

### Dockerfile + orchestrator changes

After the merge:

- **Drop `ENV WEB_PORT=4173`** from [Dockerfile](../../Dockerfile) (no second server to bind it).
- **Drop `EXPOSE $WEB_PORT`**.
- **Drop the web bundle build step** — `yarn build:web-server-bundle` is no longer needed. Either remove it from `build:prod` and from [package.json](../../package.json), or keep the script and just drop the call from `build:prod`. Removal is cleaner; the maintainer can `git revert` if a separate web server is ever wanted again.
- **Drop the second spawn from [scripts/start-prod.cjs](../../scripts/start-prod.cjs)** — only spawn the API process. The orchestrator script itself stays in place (it's still the entry point and still owns signal forwarding), but it becomes a thin parent of one child. Document at the top of the file why the script still exists with one child (future-proofing for side-cars / migrations / queue workers).

### Dev environment — do NOT touch

`yarn dev:web-server` (Vite) and `yarn dev:api-server` (tsx) **stay as separate processes**. Vite dev server provides HMR; baking the SPA into the API process at dev time would lose that. The root `yarn start` script keeps its `concurrently` call. The merge is **prod-only** — only the Dockerfile entry point and `packages/web/src/server.ts` change.

## Tests (per test-coverage discipline)

- **Integration test** for the mounted static server (in [packages/server/src/api/hono-routes.test.ts](../../packages/server/src/api/hono-routes.test.ts) or a sibling):
  - `GET /` returns the SPA's `index.html` content with `Cache-Control: no-cache, ...`.
  - `GET /some/spa/route` (no file extension) returns `index.html` (SPA fallback).
  - `GET /assets/<known-asset>.js` returns the JS asset.
  - `GET /api/version` (or any existing API route) still returns the API response, NOT the SPA — proves API routes take precedence.
  - `GET /not-a-real-file.png` returns 404 (file extension present but doesn't exist; doesn't fall through to `index.html`).
- **e2e** the existing browser tests should pass unchanged against a single-port server. Run on `PORT` only; the e2e port-protocol doc may need a `WEB_PORT` cleanup.

The integration tests need a real `packages/web/dist/index.html` to read from; either commit a tiny test fixture under a temp dir or use `memfs` via the existing vitest setup.

## TDD steps

1. **Red.** Write the integration tests above against the API app. They should fail because there's no static mount yet. Commit `test(server): failing tests for mounted SPA static assets`.
2. **Green.** Add `serveStatic` mount + `onFound` cache headers + SPA fallback rewrite to `hono-routes.ts`. Commit.
3. **REMOTE_SERVER_URL decision.** Implement the chosen option (drop or middleware). Commit with a clear message naming the choice.
4. **Dockerfile.** Drop `WEB_PORT` env, `EXPOSE`, the web bundle build step. Commit `chore(docker): collapse web mini-server into API process`.
5. **Orchestrator.** Drop the WEB spawn from `scripts/start-prod.cjs`. Update its header comment to reflect the single-child reality. Commit.
6. **Docs.** Search the repo for `WEB_PORT` and `4173` references — README, env example, agents docs, any consumer-facing docs — and update them. Commit `docs: single-port deploy after web/api merge`.
7. **Cleanup.** Delete [packages/web/src/server.ts](../../packages/web/src/server.ts) and the `prod:server` script in [packages/web/package.json](../../packages/web/package.json). Confirm `dev`/`build`/`storybook` scripts are untouched. Commit.
8. **Manifest.** Dedicated `chore(manifest):` flip commits at start (`in-progress`) and end (`done`).

## Files

- [packages/server/src/api/hono-routes.ts](../../packages/server/src/api/hono-routes.ts) — add `serveStatic` mount + cache headers + SPA fallback.
- [packages/server/src/api/hono-routes.test.ts](../../packages/server/src/api/hono-routes.test.ts) — add the integration tests above (or new sibling file if the existing one grows too large).
- [packages/web/src/server.ts](../../packages/web/src/server.ts) — delete.
- [packages/web/package.json](../../packages/web/package.json) — drop `prod:server` script.
- [Dockerfile](../../Dockerfile) — drop `WEB_PORT` env / `EXPOSE`, drop the web bundle build line.
- [scripts/start-prod.cjs](../../scripts/start-prod.cjs) — drop the WEB spawn; update header.
- [package.json](../../package.json) — drop `build:web-server-bundle` from `build:prod` (and from `scripts` if no other caller).
- README + env docs + any worker port-protocol doc that mentions `WEB_PORT` / `4173`.

## Out of scope

- The dev environment (`yarn start` / `dev:web-server` / Storybook) — Vite stays a separate process for HMR.
- Killing the orchestrator script entirely. It stays as the prod entry point (one child today; future-proofs for side-cars).
- Any further memory work — heap caps, eager-import audits, jobStore eviction. Each is its own future worker.
- Renaming / restructuring `packages/web` itself.

## Why this exists

Companion to the wrapper-tower collapse that brought container RSS from ~1 GB to roughly ~400 MB by replacing the `yarn → corepack → yarn workspace → tsx` tower with a single esbuild bundle per server (started 2026-05-18 in the same session that filed this worker). That work explicitly deferred the API+web merge because it required behaviour-affecting changes (cache headers, SPA fallback, `REMOTE_SERVER_URL` handling) and documentation churn (consumers expect both ports). This worker finishes the job — one Node process, one port, ~100 MB further RSS reduction.
