# Worker 29 — single-port Hono front-door (new `server` package)

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/29-merge-web-into-api-server`
**Worktree:** `.claude/worktrees/29_merge-web-into-api-server/`
**Phase:** 4
**Depends on:** **2d** (split `@mux-magic/server` into `@mux-magic/core` + `@mux-magic/api`). Worker 2d **must merge first** — this worker introduces a NEW `packages/server/` and that name has to be free, AND this worker consumes `core` + `api` as separate workspace deps.

**Coordinates with:** **6b** (`createRequire` banner fix for the esbuild server bundle). 6b ships ASAP to unblock prod; this worker's rewritten bundle command MUST carry the banner forward (see Phase G).
**Parallel with:** any worker that doesn't touch [packages/server/](../../packages/server/), [packages/web/src/server.ts](../../packages/web/src/server.ts), [scripts/start-prod.cjs](../../scripts/start-prod.cjs), [playwright.config.ts](../../playwright.config.ts), the root [Dockerfile](../../Dockerfile), or root `package.json` dev scripts.

> **History note.** This worker was originally scoped as a prod-only static-mount under the existing API Hono app. It was rewritten 2026-05-18 (in the same session that filed worker 2d) after the maintainer asked for a four-package layout (`cli` / `api` / `web` / new `server`), a single port across dev + prod, Vite middleware mode for HMR, and Storybook under `/storybook`. The original prod-only scope is fully subsumed.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md). Worker flips its own MANIFEST row at start (`in-progress`) and after merge (`done`).

---

## Your Mission

Replace the current two-Node-process / two-Hono-instance / two-port setup with a **single Node process** that exposes a single port (default `3000`) for everything — SPA, API, and Storybook — in both dev and prod. The new front door is a brand-new `packages/server/` package introduced by this worker (the previous `packages/server/` was renamed to `packages/api/` by worker 2d).

### Target package layout

```text
packages/
  cli/        ← unchanged surface; deps now point at @mux-magic/core (no Hono)
  core/       ← created by worker 2d. Pure domain: app-commands, tools,
                cli-spawn-operations, types. NO HTTP framework deps.
  api/        ← created by worker 2d. Hono routes + OpenAPI. Depends on
                @mux-magic/core. Exports `app`. NO listener, no `bin`.
  web/        ← unchanged (Vite SPA + Storybook)
  server/     ← NEW; this worker creates it. The front-door process.
                Boots a single Hono instance and listens on PORT.
                Imports `app` from @mux-magic/api and mounts it under
                /api. Hosts Vite (middleware mode in dev / static in
                prod) at /. Hosts Storybook at /storybook.
```

### Route table

| Path | Dev | Prod |
|---|---|---|
| `/api/*` | API Hono app mounted in-process (no proxy) | Same |
| `/storybook/*` | Vite-style middleware OR proxy → `storybook dev` on internal port (worker decides — see "Storybook strategy" below) | `serveStatic` of `packages/web/storybook-static/` |
| `/*` (everything else, SPA) | Vite in **middleware mode** mounted directly inside Hono — `createServer({ middlewareMode: true })` from Vite's Node API. HMR over the same port. | `serveStatic` of `packages/web/dist/` with SPA fallback (any extension-less path → `/index.html`) and the existing no-cache headers |

### Single port

- **One env var:** `PORT` (default `3000`). Drop `WEB_PORT` entirely from `.env.example`, README, every doc, Dockerfile (`ENV WEB_PORT=4173`, `EXPOSE $WEB_PORT`), and [packages/api/src/tools/envVars.ts](../../packages/api/src/tools/envVars.ts) (post-rename path).
- **One spawn:** `yarn start` (dev) and the container CMD (prod) both run **one** process — `node packages/server/dist/index.js` (prod) / `tsx watch packages/server/src/index.ts` (dev).
- `concurrently` disappears from the root `dev` script; the new `server` package owns spawning Vite (as middleware) and Storybook (see strategy).

---

## Step-by-step

### Phase A — Stand up `packages/server/` as the front door

1. **Create the package skeleton:**
   - `packages/server/package.json` with `"name": "@mux-magic/server"`, `"type": "module"`, devDeps on `hono`, `@hono/node-server`, `vite`, and a workspace dep on `@mux-magic/api`.
   - `packages/server/tsconfig.json` extending the root `tsconfig.base.json` (mirror `packages/api/tsconfig.json` shape).
   - `packages/server/src/index.ts` — top-level entry: load env, build the Hono root, call `serve()`.
   - `packages/server/vitest.config.ts` mirroring `packages/api/vitest.config.ts` so integration tests work.
   - Root `package.json` workspaces glob already covers `packages/*` — no change needed.

2. **Compose the Hono root in [packages/server/src/buildServer.ts](../../packages/server/src/buildServer.ts):**
   - Import `app` from `@mux-magic/api/src/api/hono-routes.js`.
   - Build a new root `Hono` instance.
   - `root.route('/api', app)` — mounts every API route under `/api/*` (so the existing `/jobs`, `/sequences`, etc. all gain the `/api` prefix; see "Route prefix migration" below).
   - In dev: create Vite via `vite.createServer({ server: { middlewareMode: true }, appType: 'spa' })`. Wrap Vite's `middlewares` as a Hono middleware (Hono → Node req/res adapter — pattern below).
   - In prod (env: `NODE_ENV === 'production'`): `root.use('*', serveStatic({ root: '<bundle-relative path to packages/web/dist>' }))` with the SPA fallback + no-cache headers from the deleted `packages/web/src/server.ts` (lines 31–47 there).
   - Storybook mount (see "Storybook strategy").
   - Return `root`. The entry point in `index.ts` calls `serve({ fetch: root.fetch, port: PORT })`.

3. **Vite-in-Hono middleware adapter.** Hono exposes `nodeAdapter` shapes via `@hono/node-server`. The pattern:
   ```ts
   const vite = await createViteServer({
     server: { middlewareMode: true },
     appType: 'spa',
   })
   root.use('*', async (c, next) => {
     await new Promise<void>((resolve, reject) => {
       vite.middlewares(c.env.incoming, c.env.outgoing, (err?: unknown) => {
         if (err) reject(err); else resolve()
       })
     })
     if (c.res.bodyUsed || c.finalized) return
     await next()
   })
   ```
   Mount this **after** `/api` and `/storybook` so Vite only catches unmatched paths. Verify `c.env.incoming`/`c.env.outgoing` are exposed by `@hono/node-server` (they are in current versions; if not, use a thin Node http adapter wrapper).

4. **Resolve static roots from the bundle, not cwd.** Use `import.meta.url` + `fileURLToPath` to compute paths to `packages/web/dist/` and `packages/web/storybook-static/`. The current [packages/web/src/server.ts:34](../../packages/web/src/server.ts#L34) reads `./dist` from cwd, which only works because the script lives in `packages/web/`. The new server runs from a different cwd, so cwd-relative paths break.

### Phase B — Route prefix migration

The current API serves routes at `/`, `/jobs`, `/sequences`, etc. After mounting at `/api`, every API path gains an `/api` prefix.

- **Frontend.** [packages/web/src/apiBase.ts](../../packages/web/src/apiBase.ts) currently returns `''` (relative) or `window.__API_BASE__`. Make it return `'/api'` (or `window.__API_BASE__ ?? '/api'` if the env-var injection is preserved per "PUBLIC_URL" below). Every `fetch('/jobs/...')` etc. then becomes `fetch('/api/jobs/...')` via the helper. Grep for direct `fetch('/'` calls that bypass the helper and route them through it.
- **OpenAPI.** [packages/api/src/api/openApiDocConfig.ts](../../packages/api/src/api/openApiDocConfig.ts) — the `servers[].url` must reflect the `/api` prefix. If `PUBLIC_URL` is set, `${PUBLIC_URL}/api`; otherwise the relative origin + `/api`.
- **Docs route.** [packages/api/src/api/routes/docRoutes.ts](../../packages/api/src/api/routes/docRoutes.ts) — `${PUBLIC_URL}/api/openapi.json` and `${PUBLIC_URL}/api/docs`.
- **CORS comment.** [packages/api/src/api/hono-routes.ts:22-27](../../packages/api/src/api/hono-routes.ts#L22-L27) references the split-host posture and `window.__API_BASE__`. Rewrite the comment to describe the single-origin reality. The `origin: '*'` setting can probably tighten to `origin: c.req.header('origin') ?? undefined` since everything is same-origin now, but defer that to a follow-up — it's a behavior change unrelated to the merge.
- **Webhook reporter / any internal HTTP calls.** Grep for hardcoded port references (`localhost:`, `PORT`, `WEB_PORT`) — anything pointing the server at its own URL needs to know about the `/api` prefix.

### Phase C — `REMOTE_SERVER_URL` → `PUBLIC_URL`, no more `index.html` rewriting

**Guardrail:** the new server NEVER mutates `packages/web/dist/index.html`. Not at boot, not per-request. The current [packages/web/src/server.ts:13-24](../../packages/web/src/server.ts#L13-L24) injection (which wrote to disk on every startup) is deleted with the file. Vite owns `index.html` in dev (via middleware mode) and the file ships as-built in prod. If a future use case truly needs runtime HTML injection, do it via a Hono middleware that rewrites the response body — not a disk write — and file it as a separate worker.

Post-merge, the variable's only purpose is **OpenAPI / docs canonical-URL rendering** (see grep summary in this worker's discussion thread). Rename it to reflect that:

- `REMOTE_SERVER_URL` → `PUBLIC_URL` in:
  - [.env.example:40](../../.env.example#L40)
  - [README.md:103](../../README.md#L103)
  - [packages/api/src/api/openApiDocConfig.ts:12-14](../../packages/api/src/api/openApiDocConfig.ts#L12-L14) (post-rename path)
  - [packages/api/src/api/routes/docRoutes.ts:10-11](../../packages/api/src/api/routes/docRoutes.ts#L10-L11) (post-rename path)
  - [playwright.config.ts:57-61](../../playwright.config.ts#L57-L61)
- Delete the `window.__API_BASE__` injection block at [packages/web/src/server.ts:13-24](../../packages/web/src/server.ts#L13-L24) (the whole file is deleted anyway — see Phase D).
- Delete the `window.__API_BASE__` declaration in [packages/web/src/types.window.d.ts](../../packages/web/src/types.window.d.ts) and the fallback in [packages/web/src/apiBase.ts](../../packages/web/src/apiBase.ts) — same-origin means it's dead weight.

### Phase D — Demolition

Files / dirs to delete entirely:
- [packages/web/src/server.ts](../../packages/web/src/server.ts) — the tiny static-file server. Its no-cache + SPA-fallback logic moves into Phase A's prod branch.
- `packages/web/dist-server/` — esbuild bundle of the above; never produced again.
- The `build:web-server-bundle` script in root [package.json:14](../../package.json#L14) and its call from `build:prod`.
- [scripts/start-prod.cjs](../../scripts/start-prod.cjs) — **deleted entirely**. The script's only jobs are spawning two children (gone after the merge) and forwarding `SIGINT`/`SIGTERM` so `docker stop` propagates. Once there is one Node process, **that process is PID 1** inside the container and Node handles its own signals natively. The "ignored-SIGTERM 5s ceiling" the script enforces is what Docker's `--init` (or `tini`) provides at the container level — set `init: true` in any orchestrator/compose config (or rely on `docker run --init`) and you get the same behavior without an extra Node process. The Dockerfile CMD becomes `["node", "packages/server/dist/index.js"]` directly.
- `concurrently` from root [package.json](../../package.json) `dev` / `start` scripts. Replace with a single `tsx watch packages/server/src/index.ts` (or whatever `yarn workspace @mux-magic/server dev` resolves to).
- `WEB_PORT` constant in [packages/api/src/tools/envVars.ts](../../packages/api/src/tools/envVars.ts) (post-rename path) and every consumer.
- `prod:server` script in [packages/web/package.json](../../packages/web/package.json) (it pointed at the deleted bundle).

Dockerfile changes:
- Drop `ENV WEB_PORT=4173`.
- Drop `EXPOSE $WEB_PORT`. Keep `EXPOSE $PORT` (default 3000).
- Drop the `# packages/web/dist-server/server.mjs ...` comment block ([Dockerfile:69](../../Dockerfile#L69) area).
- Update CMD / entrypoint to launch the new server bundle.
- Update the `yarn build:prod` chain so the new `packages/server/dist/` bundle is produced (esbuild bundle of `packages/server/src/index.ts` — mirror the existing api bundle build).

### Phase E — Storybook strategy

Two viable options. **Decide and document in the commit message.**

- **(a) Storybook proxy (dev) + serveStatic (prod).** Spawn `storybook dev` on an internal port (random, like the worker's PORT) from `packages/server/src/index.ts` when `NODE_ENV !== 'production'`. Hono mounts an HTTP proxy at `/storybook/*` → `internal:storybook-port`. Storybook started with `--base /storybook/` so its own asset URLs get the prefix. In prod, `storybook build` produces `packages/web/storybook-static/`; mount via `serveStatic` at `/storybook`. **Pros:** isolation, Storybook can keep its own Vite. **Cons:** dev spawns a second Node child; proxy needs WebSocket upgrade for Storybook's HMR.
- **(b) Single Vite (advanced).** Configure Storybook in `builder: '@storybook/builder-vite'` mode and load story modules through the front-door Vite instance. **Pros:** one Vite, true single-process. **Cons:** significant Storybook config surgery, may not be feasible if Storybook's CSF parsing assumes its own Vite plugin chain. Investigate but do not block the worker on this; **default to (a)**.

Either option requires Storybook's `base` setting to be `/storybook/` so asset URLs prefix correctly. Validate with the existing VRT setup (worker 6a) — those Playwright tests navigate to Storybook URLs and need to keep working.

### Phase F — Playwright / e2e

Current [playwright.config.ts](../../playwright.config.ts) spawns separate servers for web, storybook, and api, and injects `REMOTE_SERVER_URL` so Storybook knows where the API is. After the merge:

- **One `webServer` entry** that launches the new `packages/server/` dev process on a random port.
- `baseURL` = `http://localhost:<port>/` for SPA tests; Storybook tests navigate to `http://localhost:<port>/storybook/...`.
- Drop the `env: { REMOTE_SERVER_URL: apiBaseUrl }` injection — it's no longer meaningful (same-origin).
- Update any test that hardcodes `:4173` or `WEB_PORT`.
- Worker 6a's VRT setup may need its Storybook base URL updated to `/storybook`; coordinate via PR comment if 6a is in flight.

### Phase G — `createRequire` banner carry-forward (build script)

Worker 6b adds a `--banner:js="import{createRequire}from'node:module';const require=createRequire(import.meta.url);"` flag to the server esbuild command, fixing a prod crash where CJS deps (notably `tree-kill`) call `require("child_process")` and esbuild's `__require` shim throws. When this worker rewrites the build script to produce the new `packages/server/dist/` front-door bundle, **carry the banner forward**. Without it, the new bundle re-introduces the same crash the moment a job cancellation triggers `treeKillChild`. Add a `yarn build:prod && node packages/server/dist/index.js && curl localhost:3000/api/version` smoke test step to the worker's manual-test checklist.

### Phase H — Deployment checklist (user action, post-merge)

This worker changes the prod surface from `:PORT` (API) + `:WEB_PORT` (SPA) to a single `:PORT` (default `3000`) hosting `/api`, `/`, and `/storybook`. The maintainer's deployment environment requires **manual reconfiguration** that this PR cannot do for them; list these explicitly in the PR description so they're not missed:

- **nginx-proxy-manager** — collapse the two upstream entries (one for the API, one for the SPA) into a single upstream pointing at `:3000`. If the proxy was rewriting `/api/*` to strip the prefix or to route to a different upstream, remove that rewrite — the prefix is now meaningful in-process.
- **TrueNAS Docker Compose** — drop the `WEB_PORT` env var and the second port mapping (`4173:4173`). Keep one `${PORT:-3000}:3000` mapping. Also drop any healthcheck that hit the second port.
- **`PUBLIC_URL`** (formerly `REMOTE_SERVER_URL`) — if the deployment is behind a public hostname different from the container's view of itself, set `PUBLIC_URL` to that hostname. Otherwise omit; OpenAPI defaults to the request origin.

### Phase I — Documentation sweep

- [README.md](../../README.md) — single-port deploy, drop `WEB_PORT` row, rename `REMOTE_SERVER_URL` → `PUBLIC_URL`, update any "open `http://localhost:4173`" instructions.
- [.env.example](../../.env.example) — same renames.
- [AGENTS.md](../../AGENTS.md) and `docs/agents/*.md` — search for `WEB_PORT`, `4173`, `REMOTE_SERVER_URL`, `packages/server` (post-rename: should now be `packages/api` per worker 2d, but verify), `dev:web-server`, `dev:api-server` and update. Per the "AGENTS.md is loaded into every conversation" rule, prefer updating focused docs under `docs/agents/*.md` over inflating `AGENTS.md`.
- Architecture diagram in `docs/agents/architecture.md` (if present) — redraw with the four-package layout.

---

## Tests (per test-coverage discipline)

**TDD: failing tests first, in this order:**

1. **`packages/server/src/buildServer.test.ts`** — unit test of the assembled Hono root:
   - `root.fetch(new Request('/api/version'))` returns 200 with the API's version payload (proves API mount).
   - `root.fetch(new Request('/api/sequences'))` (or any other existing route) returns the API response, NOT the SPA.
   - `root.fetch(new Request('/'))` returns the SPA `index.html` in prod mode (use a tmp fixture or memfs for `packages/web/dist/index.html`).
   - `root.fetch(new Request('/some/spa/route'))` (no extension) returns `index.html` (SPA fallback).
   - `root.fetch(new Request('/not-a-real-file.png'))` returns 404 (does NOT fall through to `index.html` — extension present).
   - Prod-mode response includes `Cache-Control: no-cache, no-store, must-revalidate` + `Pragma: no-cache`.
2. **e2e** — existing browser tests must pass against the single-port server with `baseURL = http://localhost:<PORT>/`. Update `playwright.config.ts` first; the existing specs should require minimal changes (mostly path prefixing if they hit `/api/...` directly rather than going through the frontend).
3. **Manual smoke test** (document in PR description, not automated):
   - `yarn start` brings up one process on `:3000`. `curl localhost:3000/api/version` → version JSON. Browser → `http://localhost:3000/` → SPA loads with HMR (edit a `.tsx`, see hot update). Browser → `http://localhost:3000/storybook/` → Storybook loads.
   - Production: `yarn build:prod && node packages/server/dist/index.js` — same three URLs work with static assets.

---

## Suggested commit order

```text
1.  chore(manifest): worker 29 in-progress
2.  feat(server): create @mux-magic/server package skeleton
3.  test(server): failing buildServer.test.ts (Hono root composition)
4.  feat(server): assemble Hono root — /api mount + dev/prod SPA branch
5.  feat(server): Vite middleware mode adapter (dev /)
6.  feat(server): Storybook mount (option a: proxy in dev + static in prod)
7.  refactor(web): drop window.__API_BASE__ + apiBase fallback (same-origin)
8.  refactor(api): apiBase helper writes /api prefix; sweep fetch call sites
9.  chore(env): rename REMOTE_SERVER_URL → PUBLIC_URL, drop WEB_PORT
10. chore(web): delete src/server.ts, dist-server/, prod:server script
11. chore(scripts): delete start-prod.cjs (node is PID 1 in single-process container)
12. chore(docker): single-process container, single EXPOSE, single CMD
13. chore(root): drop concurrently from dev/start; single tsx watch
14. test(e2e): playwright single webServer + single baseURL, /api prefix
15. docs: single-port deploy, four-package layout, AGENTS.md sweep
16. chore(manifest): worker 29 done
```

---

## Files

**Created**

- [packages/server/package.json](../../packages/server/package.json)
- [packages/server/tsconfig.json](../../packages/server/tsconfig.json)
- [packages/server/vitest.config.ts](../../packages/server/vitest.config.ts)
- [packages/server/src/index.ts](../../packages/server/src/index.ts)
- [packages/server/src/buildServer.ts](../../packages/server/src/buildServer.ts)
- [packages/server/src/buildServer.test.ts](../../packages/server/src/buildServer.test.ts)
- (helpers as needed: `viteMiddleware.ts`, `storybookMount.ts`)

**Modified**

- [packages/api/src/api/hono-routes.ts](../../packages/api/src/api/hono-routes.ts) — update CORS comment; verify no `serve()` call remains (worker 2d should have removed it, but double-check).
- [packages/api/src/api/openApiDocConfig.ts](../../packages/api/src/api/openApiDocConfig.ts) — `PUBLIC_URL` + `/api` prefix.
- [packages/api/src/api/routes/docRoutes.ts](../../packages/api/src/api/routes/docRoutes.ts) — same.
- [packages/api/src/tools/envVars.ts](../../packages/api/src/tools/envVars.ts) — drop `WEB_PORT`, rename `REMOTE_SERVER_URL` → `PUBLIC_URL`.
- [packages/web/src/apiBase.ts](../../packages/web/src/apiBase.ts) — return `/api`, drop window fallback.
- [packages/web/src/types.window.d.ts](../../packages/web/src/types.window.d.ts) — drop `__API_BASE__` declaration.
- [packages/web/package.json](../../packages/web/package.json) — drop `prod:server` script.
- [package.json](../../package.json) — drop `build:web-server-bundle`, drop `concurrently` from dev scripts, point `start` at the new server.
- [Dockerfile](../../Dockerfile) — single EXPOSE, drop `WEB_PORT` env, drop dist-server build step + comment, update CMD.
- [scripts/start-prod.cjs](../../scripts/start-prod.cjs) — **deleted** (single-process container; `node` is PID 1; signals handled natively or via Docker `--init`).
- [playwright.config.ts](../../playwright.config.ts) — single webServer, single baseURL, drop env injection.
- [.env.example](../../.env.example) — rename `REMOTE_SERVER_URL` → `PUBLIC_URL`, drop `WEB_PORT`.
- [README.md](../../README.md) — env-var table + single-port deploy.
- [AGENTS.md](../../AGENTS.md) + `docs/agents/*.md` — sweep.

**Deleted**

- [packages/web/src/server.ts](../../packages/web/src/server.ts)
- `packages/web/dist-server/` (rebuild artifact, gitignored — just ensure it's never produced)

---

## Out of scope

- CORS tightening (today: `*`; same-origin makes a stricter policy possible, but it's an unrelated behavior change — file as a follow-up if desired).
- Auth / reverse-proxy considerations — the maintainer treats this as a single-user local tool; if a future deployment posture changes that, a dedicated worker handles auth.
- Memory / heap-cap tuning beyond the structural simplification this delivers.
- Renaming/restructuring inside `packages/web` (Vite config, Storybook stories layout, etc.).
- Folding Storybook into the front-door Vite instance — investigate but ship with option (a) unless option (b) turns out trivially feasible.

---

## Why this exists

The current layout runs **two Node processes** in prod (API on `PORT` + tiny static-file Hono on `WEB_PORT`) and **three child processes** in dev (Vite, API tsx-watch, Storybook), all on different ports. Each Node baseline costs ~80–150 MB RSS; the dev wrangling forces `concurrently`, port-collision handling, and `REMOTE_SERVER_URL` to bridge the SPA origin to the API origin.

This worker collapses all of that into **one Node process on one port** by making the new `packages/server/` the sole HTTP boundary. The API becomes a mounted Hono sub-app (no proxy, no second TCP listener). Vite serves the SPA via middleware mode — HMR over the same port. Storybook lives at `/storybook`. Production swaps Vite middleware for `serveStatic(dist)` while keeping every other route mount identical.

Companion to the wrapper-tower collapse (yarn→corepack→tsx removal, ~600 MB RSS savings, landed 2026-05-18 in commit `9e3ecef2`) and worker 2d's mechanical `server`→`api` package rename. Together they take the deploy from "two Nodes wrapped in three layers of process managers" to "one Node, one port, one CMD line." Local dev simplifies by the same factor — `yarn start` becomes a single child.
