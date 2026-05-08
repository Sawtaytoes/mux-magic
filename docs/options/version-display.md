# Version display — surface build identity in both apps

Audience: media-tools and media-sync. Driven by W13's diagnostic, which
left us unable to confirm whether a deployed Docker container actually
contains the latest commit. We need a build identity (git SHA, build
timestamp, package version) reachable from three places:

1. The web UI (small footer on every page).
2. The server boot console (one banner line).
3. A scripted/curlable endpoint (so CI or a one-line `curl` can answer
   "is this image current?" without opening a browser).

The same data should drive all three surfaces.

## Status quo

- Neither media-tools nor media-sync stamps any build identity into the
  image, the server logs, or the UI.
- media-tools already publishes a per-process `bootId` over SSE via
  `src/api/routes/serverIdRoutes.ts`. That is the architectural shape
  we want to mirror for `/version` — a tiny route alongside the existing
  identity surface area.
- media-tools `Dockerfile` (`node:24-slim`, single-stage) `apt install`s
  `git`, so `git rev-parse` works at image-build time and at runtime
  inside the container.
- media-sync `Dockerfile` (`node:24-slim`) does **not** install `git`.
  Adding it bloats the image; passing `GIT_SHA` as a `--build-arg` from
  the CI runner avoids that.
- media-sync UI bootstrap (`packages/web-server/public/jobs/script.js`)
  already calls `loadSystemConfig()` on `DOMContentLoaded`; a
  `loadVersion()` call slots in trivially next to it.
- Neither jobs UI nor builder UI has a global footer today, so adding
  one is a fresh element rather than a refactor.
- Deploy paths differ: media-tools deploys via GitHub Actions;
  media-sync deploys via Gitea Actions (deploy 43 ran from commit
  `dea58ad7…` per `C:/Users/satur/Downloads/deploy-docker-deploy-43.log`).
  Both pipelines can pass `--build-arg`s if we want.

## Options

| # | Approach | Build → Server | Server → UI | Tradeoff |
|---|----------|----------------|-------------|----------|
| A | Docker `--build-arg GIT_SHA` + `BUILD_TIME`, baked as `ENV` | `process.env.GIT_SHA` read in route handler | UI fetches `/version` JSON | Zero new files; every caller of `docker build` must remember the args or the value silently becomes "unknown". |
| B | Generated `src/gitHash.generated.ts` (or `.json`) written by `prebuild`/`postinstall` script | `import` the generated module | UI fetches `/version` JSON | TypeScript-checked; needs `git` available wherever the script runs (media-sync would need `apt install git` or run it outside Docker). |
| C | Read `package.json#version` + a `BUILD_TIME` env var | `import pkg.version` | UI renders semver | Useless for "is this the latest commit?" — media-tools `version` is `1.0.0` and never moves; media-sync root `package.json` has no version at all. |
| D **(recommended)** | Build-time `version.json` written by a script, served by a `/version` route, consumed by UI footer + boot banner | Route reads `version.json` (or imports the generated module); honors `process.env.GIT_SHA` / `BUILD_TIME` as a fallback | UI fetches `/version` and sets footer text; server logs same string on boot | One small script + one route + one footer per app; works in dev, in Docker (with `--build-arg` fallback so media-sync needs no `git`), and via `curl`. Single source of truth. |

## Recommendation: Option D

Option D is a tiny superset of Option B that also exposes a curl-able
`/version` endpoint, which is exactly the scripted check that drove
this work in the first place. The endpoint mirrors media-tools'
existing `serverIdRoutes.ts` precedent — boot identity already lives
under that architectural shape, and build identity is the natural
sibling. The same `version.json` drives the UI footer, the boot
banner, and the JSON endpoint, so there is one source of truth per
build. Option A is a fine fallback if we ever decide to ship zero new
source files, but it shifts the burden onto every `docker build`
caller, where forgetting a `--build-arg` results in a silent
`unknown` — the worst possible failure mode for a check whose entire
purpose is detecting silent staleness.

## Implementation footprint (for W14b)

### Shared response shape

```json
{
  "gitSha": "abc1234",
  "buildTime": "2026-05-07T12:34:56Z",
  "packageVersion": "1.0.0",
  "nodeVersion": "v24.x.y"
}
```

The script populating `version.json` should use, in order:

1. `process.env.GIT_SHA` if set (CI build-arg path — required for
   media-sync since its Dockerfile has no `git`).
2. Output of `git rev-parse --short HEAD` if `git` is on PATH (dev +
   media-tools Docker build path).
3. The literal `"unknown"` as a last resort.

`buildTime` follows the same pattern: prefer `process.env.BUILD_TIME`,
fall back to `new Date().toISOString()` at script execution time.

Footer string format: `git@<shortSha> · built <ISO-without-seconds>`.
Boot banner format: `[BUILD] git=<shortSha> built=<ISO> node=<version>`.

### media-tools (~6 files)

- `scripts/writeVersion.mjs` — emits `public/api/version.json`. Wired
  to `prebuild` and `postinstall` in `package.json`.
- `src/api/routes/versionRoutes.ts` — Hono `GET /version`, reads the
  JSON file (or imports a generated module). Mounted in
  `src/api/hono-routes.ts` next to `serverIdRoutes`.
- `public/api/index.html` — append `<footer class="version-footer">`
  with a `<span id="build-version">` populated by an inline
  `fetch('/version')`.
- `public/api/builder/index.html` — same footer pattern, Tailwind
  classes to match the existing chrome.
- `src/api-server.ts` (or wherever the server logs its boot line) —
  one `logInfo("BUILD", ...)` call.
- `.gitignore` — add `public/api/version.json`.

`Dockerfile` needs no change: `git` is already installed and
`postinstall` re-runs the script after `yarn install`, so the JSON
gets stamped at every build.

### media-sync (~5 files)

- `packages/web-server/scripts/writeVersion.mjs` — same script,
  emits `packages/web-server/public/version.json`.
- `packages/web-server/package.json` — `prestart-server` (or
  `postinstall`) hook.
- `packages/web-server/src/routes/versionRoute.ts` — Hono `GET /`
  mounted as `api.route("/version", versionRoute)` in
  `packages/web-server/src/main.ts` (matches the existing
  `healthRoute` shape).
- `packages/web-server/public/jobs/index.html` (and `public/index.html`
  and `public/downloader/index.html` if we want full coverage) — small
  `<footer>` with version span; `script.js` calls `loadVersion()` from
  `DOMContentLoaded` next to `loadSystemConfig()`.
- `packages/web-server/src/main.ts` — boot banner log line.

`Dockerfile` does **not** need `apt install git` if Gitea Actions
passes `--build-arg GIT_SHA=$(git rev-parse --short HEAD)` and
`--build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)`, and the
Dockerfile re-exposes them as `ENV` so the `postinstall` script picks
them up. This is the recommended path; it keeps the image lean.

## Open questions for the user

- **SHA length** — short (7 chars) or long (40)? Short is friendlier in
  the footer; long is unambiguous for grep-against-`git log`.
  Recommendation: short, with the long form available via `/version`
  JSON.
- **Branch name** — include `branch` in the JSON? Useful when staging
  builds run from non-`master` branches; noise on production where
  it's always `master`. Recommendation: include it, render only when
  not `master`.
- **Auth on `/version`** — expose to unauthenticated clients, or gate
  behind whatever auth the rest of the API uses? media-tools is
  currently LAN-only; media-sync the same. Leaking a git SHA is
  low-risk but non-zero. Recommendation: leave unauthenticated to
  match `/health` and `bootId`, both of which are already public.
- **Bust browser cache for `version.json`** — append `?t=<Date.now()>`
  to the fetch URL, or rely on the route bypassing the static
  middleware? Recommendation: serve via the route handler (not the
  static middleware) so the JSON is always fresh and there is no
  cache layer to bust.
- **Stamp media-sync `web-server` package version** — do we want to
  start moving `package.json#version` per release so the `packageVersion`
  field is meaningful, or accept that it stays `0.0.0`/absent and rely
  on `gitSha` alone?
