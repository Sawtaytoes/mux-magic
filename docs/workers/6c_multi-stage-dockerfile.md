# Worker 6c — multi-stage Dockerfile, drop devDependencies + source from runtime

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/6c-multi-stage-dockerfile`
**Worktree:** `.claude/worktrees/6c_multi-stage-dockerfile/`
**Phase:** 4
**Depends on:** **29** (single-port front-door). 29 already restructures the Dockerfile (single `EXPOSE`, single `CMD`, drops `start-prod.cjs` and `WEB_PORT`); doing the multi-stage rewrite on top of 29's clean single-stage baseline avoids two compounding diffs.
**Parallel with:** anything not touching [Dockerfile](../../Dockerfile), [.dockerignore](../../.dockerignore) (may not exist yet — this worker creates it), root build scripts, or worker 29's in-flight Dockerfile changes.

## Universal Rules (TL;DR)

Worktree-isolated. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint` plus a real container build and boot smoke test (`docker build . && docker run -p 3000:3000 …` → SPA loads, `/api/version` returns, ffmpeg job runs, job cancellation works). Yarn only. Worker flips its own MANIFEST row at start (`in-progress`) and after merge (`done`).

## Your Mission

Rewrite [Dockerfile](../../Dockerfile) from its current single-stage layout (which copies the whole source tree, runs `yarn install` with full devDeps, and ships everything) into a **two-stage builder / runtime pattern**. Reference: `../gallery-downloader/Dockerfile` (sibling repo) uses the same pattern for its own packages.

After 29 lands (which collapses to one Node process / one port / no `start-prod.cjs`), the runtime path is `node --enable-source-maps packages/server/dist/index.js` against the self-contained esbuild bundle. That bundle inlines every dep except the four `--external:` exceptions (`playwright`, `playwright-core`, `chromium-bidi/*`, `./xhr-sync-worker.js`). So the runtime stage needs **almost no `node_modules`** at all — only the Playwright runtime and Chromium binary.

### Target structure

```dockerfile
# ---------- Builder stage ----------
FROM node:24-slim AS builder
WORKDIR /app

# Cache-friendly install layer: only files that affect `yarn install`
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn .yarn
COPY packages/*/package.json packages/*/   # each workspace's package.json

# Pre-install Corepack + Yarn
RUN npm install -g corepack@latest && corepack enable yarn

# Full install (devDeps included) — needed for the build
RUN yarn install

# Source + build
COPY . .
RUN yarn build:prod
# Produces:
#   packages/web/dist/                          (Vite SPA build)
#   packages/server/dist/index.js (+ .map)      (esbuild bundle of the new server)
#   public/api/version.json                     (build identity)
#   packages/web/storybook-static/              (Storybook build, if applicable)

# ---------- Runtime stage ----------
FROM node:24-slim AS runtime
WORKDIR /app

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NODE_ENV=production
ENV PORT=3000

# System apt deps the BUNDLE needs at runtime (ffmpeg/mkvtoolnix/mediainfo
# for the spawn-ops; python3+pipx for audio-offset-finder; ca-certificates
# + locales for general TLS / UTF-8). Build-only apt deps (build-essential,
# git, wget) stay in the builder stage.
RUN \
  apt-get update && \
  apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg locales mediainfo pipx procps python3 && \
  sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen && \
  update-ca-certificates && \
  rm -rf /var/lib/apt/lists/*

# mkvtoolnix repo + install (same as builder; runtime needs the actual binary)
RUN \
  apt-get update && apt-get install -y --no-install-recommends wget && \
  wget -O /etc/apt/keyrings/gpg-pub-moritzbunkus.gpg https://mkvtoolnix.download/gpg-pub-moritzbunkus.gpg && \
  echo "deb [signed-by=/etc/apt/keyrings/gpg-pub-moritzbunkus.gpg] https://mkvtoolnix.download/debian/ bookworm main" > /etc/apt/sources.list.d/mkvtoolnix.download.list && \
  apt-get update && apt-get install -y --no-install-recommends mkvtoolnix && \
  apt-get remove -y wget && apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/*

# Python: audio-offset-finder
COPY requirements.txt ./
RUN pipx install audio-offset-finder && pipx ensurepath

# Corepack + production-only install of the FOUR `--external:` deps the
# esbuild bundle leaves unresolved. `yarn workspaces focus --production`
# is Yarn 4's built-in equivalent of the old `npm install --production`.
RUN npm install -g corepack@latest && corepack enable yarn
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn .yarn
COPY packages/*/package.json packages/*/
RUN yarn workspaces focus --production --all

# Playwright Chromium binary + its system libs (libnss3, libxkbcommon0,
# fonts, etc.). Has to run AFTER yarn install so the playwright CLI exists.
RUN yarn install-playwright-browser --with-deps chromium

# Build artifacts from the builder stage. Source .ts NOT copied — sourcemaps
# point at original paths via `--enable-source-maps` and the .map files
# alone are enough for stack-trace rewriting.
COPY --from=builder /app/packages/web/dist            packages/web/dist
COPY --from=builder /app/packages/web/storybook-static packages/web/storybook-static
COPY --from=builder /app/packages/server/dist         packages/server/dist
COPY --from=builder /app/public/api/version.json      public/api/version.json

ARG GIT_SHA
ARG BUILD_TIME
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME

EXPOSE $PORT

CMD ["node", "--enable-source-maps", "packages/server/dist/index.js"]
```

(Shape is illustrative — the worker shapes the final file to match the current repo's conventions; comments above describe the intent.)

### Key design decisions to honor

- **No source `.ts` in the runtime image.** Stack traces resolve via `.map` files only. Drop `COPY . .` from the runtime stage entirely.
- **No `.git` in the runtime image.** `GIT_SHA` and `BUILD_TIME` come in as build args from CI (already configured in the current Dockerfile, lines 56-59). The current `COPY . .` brings `.git` along; the multi-stage rewrite leaves it in the builder only. Verify `scripts/build-version.cjs` is invoked in the builder stage (via `yarn build:prod`), not at container start — the version JSON should be a build artifact baked into the image.
- **`.dockerignore` file.** Add one if it doesn't exist. Include `node_modules`, `dist`, `**/dist`, `.git`, `.claude`, `.vscode`, `*.log`, `playwright-report`, `test-results` — anything the builder doesn't need from the host context. Speeds up `COPY . .` in the builder stage dramatically (no shipping 1+ GB of cached `node_modules` from the host).
- **System apt deps split.** Build-only (`build-essential`, `git`, `wget` for one-off downloads) stay in the builder. Runtime-only (`ffmpeg`, `mkvtoolnix`, `mediainfo`, `procps`, `python3`, `pipx`, `ca-certificates`, `locales`) move to the runtime stage. `wget` is used twice (mkvtoolnix repo key + builder); in runtime it can be installed-then-removed as a transient build dep for the mkvtoolnix key step.
- **Playwright runs in the runtime stage.** Its Chromium binary is a runtime artifact, not a build artifact. The bundle externalizes `playwright` / `playwright-core` / `chromium-bidi/*`, so those packages must be in runtime's `node_modules` — `yarn workspaces focus --production --all` will install them since they're in `dependencies`.
- **Target image size.** Current single-stage image is approximately 1.5–2 GB (full devDeps + source + .git + bundled output + Chromium). Target: < 600 MB by dropping devDeps, source, `.git`, and the build toolchain (`tsc`, `tsx`, `vitest`, `biome`, `eslint`, etc.). Chromium itself is ~250 MB of that floor and is non-negotiable.

### Verification

- `docker build . -t mux-magic:multistage` — succeeds end-to-end.
- `docker image ls mux-magic:multistage` — image size noticeably smaller than the current single-stage build. Document the before/after numbers in the PR description.
- `docker run --init -p 3000:3000 mux-magic:multistage` — boots cleanly; `curl localhost:3000/api/version` returns valid JSON; SPA loads at `/`; Storybook loads at `/storybook`.
- Trigger an ffmpeg job and a job cancellation — verify ffmpeg spawns and `treeKillChild` kills it cleanly. (This validates that the four `--external:` deps + Chromium are correctly installed and that the runtime image isn't missing any apt dep.)
- Pipe a stack trace through — confirm sourcemaps still work (`--enable-source-maps` on the `CMD` does its job; this should already work from worker 6b, just verifying it survives the restructure).
- Stack-trace sanity check on `/api/errors` if worker 2b's persisted-error surface is live — confirm captured stack frames reference `.ts` paths.

### `.dockerignore` content

If [.dockerignore](../../.dockerignore) doesn't exist or is sparse, the worker creates it. Suggested minimum:

```text
.git
.github
.claude
.vscode
.idea
node_modules
**/node_modules
**/dist
**/dist-server
**/storybook-static
playwright-report
test-results
*.log
docs
README.md
.env*
!.env.example
```

(Keep `.env.example` accessible if any docs reference it; otherwise drop it too.)

## Files

- [Dockerfile](../../Dockerfile) — full rewrite, two-stage.
- [.dockerignore](../../.dockerignore) — created or expanded.
- Possibly [scripts/build-version.cjs](../../scripts/build-version.cjs) — verify it's invoked at build time (in the builder stage) and not at container start. If today it runs in a `predocker-start` hook or something similar, refactor so the version JSON is fully baked at build time.

## Suggested commit order

```text
1. chore(manifest): worker 6c in-progress
2. chore(docker): add .dockerignore to slim build context
3. refactor(docker): split into builder + runtime stages
4. chore(docker): drop build-only apt deps from runtime stage
5. chore(manifest): worker 6c done
```

## Out of scope

- Switching base image away from `node:24-slim` (Alpine, distroless, etc.). Possible follow-up — Alpine on Node is famously tricky because of musl vs. glibc and Playwright's Chromium expects glibc. Distroless would need careful eval. Punt until a real size or attack-surface complaint surfaces.
- Multi-arch builds (`linux/amd64` + `linux/arm64`). The existing CI workflow already controls platform tagging — worker 6c keeps that orthogonal.
- Bundle-size optimization on the esbuild output itself. Different concern, different worker.
- Switching from `apt` to a smaller package manager for runtime deps.
- Restructuring how the Playwright Chromium binary is downloaded (the `playwright install --with-deps chromium` step is slow and large; reducing it would meaningfully shrink the image but it's a separate investigation).

## Why this exists

Two compounding wins:

1. **Image size.** The current single-stage image ships the entire source tree, full `node_modules` (devDeps and all), `.git`, plus a build toolchain that's only useful at build time (`tsc`, `tsx`, `vitest`, `biome`, `eslint`, `@playwright/test`, etc.). Multi-stage drops everything that isn't runtime. Expect ~1 GB savings depending on what's currently in `node_modules`.
2. **Layering honesty.** The builder/runtime split is the canonical Docker pattern for compiled-language apps. The current single-stage Dockerfile predates the esbuild bundle landing (commit `9e3ecef2`) — at the time, the runtime needed source + tsx + node_modules, so multi-stage wouldn't have helped. Now that the bundle is self-contained, the multi-stage pattern is the natural fit and the savings are substantial.

This worker comes AFTER 29 because 29 has its own large Dockerfile diff (single `EXPOSE`, single `CMD`, drop the second-spawn orchestrator). Stacking the multi-stage rewrite on top of 29's clean single-stage baseline keeps each diff focused — 29 changes *what runs*; 6c changes *how the image is layered*. Reviewers can read each PR top-to-bottom without context-switching between two concerns.

Sibling reference: `../gallery-downloader/Dockerfile` already implements this pattern with `yarn workspaces focus --production --all` and the same `--enable-source-maps` invocation. Mux-magic's variant differs only because the esbuild bundle lets the runtime carry an even thinner `node_modules` than gallery-downloader's tsc-per-workspace approach needs.
