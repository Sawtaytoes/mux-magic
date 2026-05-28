# ---------- Builder stage ----------
# Installs ALL deps (devDeps included) and runs `yarn build:prod` to produce
# the self-contained esbuild bundle, the Vite SPA build, command-descriptions,
# and version.json. Everything in this stage is discarded — nothing ships in
# the final image except the build artifacts copied across the stage boundary.
FROM node:24-slim AS builder
WORKDIR /app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Build-only apt deps: build-essential for native-module compiles during
# yarn install, git for `git rev-parse HEAD` if the version script falls
# back to it. wget/ca-certificates stay runtime-side (mkvtoolnix key fetch
# happens in the runtime stage transiently).
RUN \
  apt-get update && \
  apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    git \
  && \
  rm -rf /var/lib/apt/lists/*

RUN \
  npm install -g corepack@latest && \
  corepack enable yarn

# Cache-friendly install layer: only the files that affect `yarn install`
# get copied here, so source-only edits don't bust the install layer. Each
# workspace's package.json is copied explicitly because yarn needs the full
# workspace topology before it can resolve `workspace:*` references.
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn .yarn
COPY packages/api/package.json     packages/api/package.json
COPY packages/cli/package.json     packages/cli/package.json
COPY packages/core/package.json    packages/core/package.json
COPY packages/server/package.json  packages/server/package.json
COPY packages/tools/package.json   packages/tools/package.json
COPY packages/web/package.json     packages/web/package.json

RUN yarn install --immutable

# Rest of the source tree. .dockerignore keeps node_modules / .git / build
# outputs / docs out of this COPY so it only carries what the build needs.
COPY . .

# Build identity. CI passes --build-arg GIT_SHA=… / BUILD_TIME=…; if absent
# the build-version script falls back to `git rev-parse HEAD` (git is
# available in this stage) and `new Date().toISOString()`. Setting them as
# ENV in the builder makes `yarn build:prod` (which invokes build-version.cjs)
# pick them up via process.env.
ARG GIT_SHA
ARG BUILD_TIME
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME

# build:prod chains into tsx scripts (build:command-descriptions, etc.) that
# import `@mux-magic/tools` via the bare specifier. tsx resolves that through
# the package's "default" export (./dist/index.js) — it doesn't claim the
# "source" condition that Vite/vitest use. Without this step `build:prod`
# dies on the first tsx-loaded `import "@mux-magic/tools"` with
# ERR_MODULE_NOT_FOUND.
RUN yarn build:tools

# Produces:
#   - public/api/version.json                (build identity)
#   - packages/web/public/command-descriptions.js (copied into the Vite build)
#   - packages/web/dist/                     (Vite SPA build)
#   - packages/server/dist/index.js (+ .map) (esbuild bundle of the front-door)
RUN yarn build:prod


# ---------- Runtime stage ----------
# Production-only deps + the build artifacts. No `tsx`, `typescript`,
# `vitest`, `biome`, `eslint`, `@playwright/test`, `build-essential`, `git`,
# or source `.ts` files. Stack traces resolve via the `.map` files alone
# under `--enable-source-maps`.
FROM node:24-slim AS runtime
WORKDIR /app

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NODE_ENV=production
ENV PORT=3000

# Runtime apt deps. ffmpeg/mkvtoolnix/mediainfo are spawned by the cli
# operations; python3 + pipx host audio-offset-finder; procps gives the
# tree-kill child-process discovery something to inspect; ca-certificates +
# locales cover TLS and UTF-8.
#
# wget is installed transiently to fetch the mkvtoolnix repo key, then
# removed in the same RUN so the final layer doesn't carry it. The system
# `chromium` apt package is intentionally NOT installed — Playwright manages
# its own Chromium binary via `playwright install --with-deps chromium`
# below (which pulls the matching libnss3 / libxkbcommon0 / font deps under
# the hood).
RUN \
  touch .env && \
  apt-get update && \
  apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    locales \
    mediainfo \
    pipx \
    procps \
    python3 \
    wget \
  && \
  sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen && \
  update-ca-certificates && \
  wget -O /etc/apt/keyrings/gpg-pub-moritzbunkus.gpg https://mkvtoolnix.download/gpg-pub-moritzbunkus.gpg && \
  echo "deb [signed-by=/etc/apt/keyrings/gpg-pub-moritzbunkus.gpg] https://mkvtoolnix.download/debian/ bookworm main" > /etc/apt/sources.list.d/mkvtoolnix.download.list && \
  apt-get update && \
  apt-get install -y --no-install-recommends mkvtoolnix && \
  apt-get remove -y wget && \
  apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/*

# audio-offset-finder (Python) — runs out-of-process so it lives in pipx
# rather than being bundled. pipx drops the entry point in
# /root/.local/bin; `pipx ensurepath` only patches ~/.bashrc, but Node's
# child_process.spawn doesn't go through a shell, so the binary stays
# invisible to runAudioOffsetFinder unless PATH is set on the container's
# process env directly.
ENV PATH="/root/.local/bin:${PATH}"
COPY requirements.txt ./
RUN \
  pipx install audio-offset-finder && \
  pipx ensurepath

# Corepack + production-only Yarn install. `yarn workspaces focus
# --production --all` is Yarn 4's built-in equivalent of `npm install
# --production` across every workspace — it installs `dependencies` only,
# skipping `devDependencies` entirely. The esbuild bundle leaves five deps
# unresolved via --external (playwright, playwright-core, chromium-bidi/*,
# ./xhr-sync-worker.js, vite); those plus their transitive deps are what
# this install layer actually needs to produce.
RUN \
  npm install -g corepack@latest && \
  corepack enable yarn

COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn .yarn
COPY packages/api/package.json     packages/api/package.json
COPY packages/cli/package.json     packages/cli/package.json
COPY packages/core/package.json    packages/core/package.json
COPY packages/server/package.json  packages/server/package.json
COPY packages/tools/package.json   packages/tools/package.json
COPY packages/web/package.json     packages/web/package.json

RUN yarn workspaces focus --production --all

# Playwright Chromium binary + matching system libs (libnss3, libxkbcommon0,
# fonts, etc.). Has to run AFTER yarn install so the playwright CLI is on
# disk; --with-deps invokes apt under the hood, which is fine because the
# container runs as root.
RUN yarn install-playwright-browser

# Build artifacts only — no source .ts. The .map files alone are enough for
# `--enable-source-maps` to rewrite stack traces back to the original TS
# paths without the source actually being present at runtime.
COPY --from=builder /app/packages/web/dist    packages/web/dist
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/public/api/version.json public/api/version.json

# Re-stamp the runtime image with build identity so /api/version + the boot
# banner + the UI footer answer with real values. The version.json copied
# above already encodes these, but exporting them as ENV lets any
# late-binding consumer (or a re-run of build-version inside the container,
# e.g. for a debug session) pick them up.
ARG GIT_SHA
ARG BUILD_TIME
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME

EXPOSE $PORT

# Single process. Node is PID 1 in the container; Docker's signal handling
# (use `docker run --init` or the orchestrator's `init: true` to install a
# minimal init like tini) propagates SIGTERM/SIGINT directly to Node.
CMD ["node", "--enable-source-maps", "packages/server/dist/index.js"]
