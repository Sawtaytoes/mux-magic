# ---------- MakeMKV source stage ----------
# MakeMKV has no distro package and building it needs the oss+bin tarball
# pair and a compiler. jlesage's image already has a working build, and
# /opt/makemkv is SELF-CONTAINED: it ships its own glibc loader and
# libraries under /opt/makemkv/lib and resolves through them rather than
# the host's.
#
# That is why this transplants onto a different base at all. Running `ldd`
# on makemkvcon inside the Alpine original prints a screenful of "symbol
# not found" relocation errors, because Alpine's musl ldd resolves against
# musl. The binary runs correctly regardless. Don't be alarmed by ldd here,
# and don't "fix" it by installing glibc compat.
#
# Lifted verbatim from rip-deck, which has run this exact transplant onto
# this exact base (node:26-trixie-slim) since 2026-07-25. Bumping this tag
# is automated by .github/workflows/makemkv-tag-watcher.yml.
FROM ghcr.io/jlesage/makemkv:v26.08.2 AS makemkv

# ---------- Builder stage ----------
# Installs ALL deps (devDeps included) and runs `yarn build:prod` to produce
# the self-contained esbuild bundle, the Vite SPA build, command-descriptions,
# and version.json. Everything in this stage is discarded — nothing ships in
# the final image except the build artifacts copied across the stage boundary.
#
# Pinned to the -trixie- (Debian 13) variant rather than bare -slim (which
# tracks Debian stable and would silently move the base): trixie's apt ships
# ffmpeg 7.x (vs bookworm's 5.1.x) for the runtime stage's media tooling.
FROM node:26-trixie-slim AS builder
WORKDIR /app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Build-only apt deps: build-essential for native-module compiles during
# yarn install and the numpy source build below, git for `git rev-parse HEAD`
# if the version script falls back to it, python3 + python3-dev + python3-venv
# to build the audio-offset-finder venv. wget/ca-certificates stay runtime-side
# (mkvtoolnix key fetch happens in the runtime stage transiently).
RUN \
  apt-get update && \
  apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    git \
    python3 \
    python3-dev \
    python3-venv \
  && \
  rm -rf /var/lib/apt/lists/*

# audio-offset-finder (Python, invoked out-of-process by the audio-offset
# command) is compiled HERE in the builder — which has build-essential +
# python3-dev — and the finished venv is copied into the runtime stage, which
# has no toolchain. It pins numpy<2, and numpy <2 ships no wheel for Python 3.13
# (this trixie base's system python3), so numpy 1.26.4 is built from source
# against 3.13; scipy/librosa/matplotlib install from their own 3.13 wheels.
# Keeping it on the base's Python 3.13 (rather than a separate pinned
# interpreter) matches the cloudcli/t3code agent images. Own layer keyed only on
# requirements.txt (audio-offset-finder==0.5.5) so the ~minute numpy compile
# stays cached across source edits.
COPY requirements.txt ./
RUN python3 -m venv /opt/aof-venv \
  && /opt/aof-venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/aof-venv/bin/pip install --no-cache-dir -r requirements.txt

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
FROM node:26-trixie-slim AS runtime
WORKDIR /app

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NODE_ENV=production
ENV IS_CONTAINERIZED=true
ENV PORT=3000

# Runtime apt deps. ffmpeg/mkvtoolnix/mediainfo are spawned by the cli
# operations; python3 runs the audio-offset-finder venv copied from the builder
# (the venv's interpreter symlink resolves to this system python3, same 3.13);
# procps gives the tree-kill child-process discovery something to inspect;
# ca-certificates + locales cover TLS and UTF-8.
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
    procps \
    python3 \
    wget \
  && \
  sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen && \
  update-ca-certificates && \
  wget -O /etc/apt/keyrings/gpg-pub-moritzbunkus.gpg https://mkvtoolnix.download/gpg-pub-moritzbunkus.gpg && \
  echo "deb [signed-by=/etc/apt/keyrings/gpg-pub-moritzbunkus.gpg] https://mkvtoolnix.download/debian/ trixie main" > /etc/apt/sources.list.d/mkvtoolnix.download.list && \
  apt-get update && \
  apt-get install -y --no-install-recommends mkvtoolnix && \
  apt-get remove -y wget && \
  apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/*

# audio-offset-finder — copy the venv built (and numpy-compiled) in the builder
# stage. `PATH` is set on the container's process env directly because Node's
# child_process.spawn doesn't go through a shell, so a shell-rc PATH edit
# wouldn't reach runAudioOffsetFinder; putting the venv's bin/ first exposes the
# `audio-offset-finder` entry point. The venv is self-contained (numpy's
# from-source build bundles its own linear-algebra), so no extra apt libs are
# needed at runtime beyond the system python3 the interpreter symlink resolves to.
COPY --from=builder /opt/aof-venv /opt/aof-venv
ENV PATH="/opt/aof-venv/bin:${PATH}"

# makemkvcon — reads a `[BACKUP]` folder's BDMV tree directly
# (`info file:/media/Disc-Rips/[BACKUP] …`), so no optical drive and no
# `--device` passthrough is needed here, unlike rip-deck.
COPY --from=makemkv /opt/makemkv /opt/makemkv
ENV PATH="/opt/makemkv/bin:${PATH}"

# The transplant, asserted rather than assumed.
#
# `--cache=1` and a nonexistent `disc:9999` keep this cheap and
# device-free; the point is only that the bundled loader resolves on THIS
# base. Matching MSG:1005 rather than the exit code is deliberate —
# makemkvcon exits 0 on "Failed to open disc", so an exit code proves
# nothing, while the startup banner can only come from a binary that
# actually started. Costs one empty layer and turns a future base bump
# from a runtime surprise into a build failure.
RUN makemkvcon -r --cache=1 info disc:9999 \
  | grep -q 'MSG:1005.*started'

# MakeMKV keeps its registration key in `$HOME/.MakeMKV/settings.conf`.
#
# rip-deck can set `ENV HOME=/config` image-wide because makemkvcon is all
# it runs. mux-magic CANNOT: it also runs ffmpeg, mkvtoolnix, Playwright
# and a Python venv, and moving HOME would move all of their state too. So
# HOME is set PER SPAWN in runMakeMkvCon.ts, from this variable, and
# nothing else in the image sees it.
#
# Deployment binds the real key in:
#   /mnt/TrueNAS-Apps/App-Configs/mux-magic/makemkv -> /makemkv-config
# containing .MakeMKV/settings.conf. The key is NEVER baked into the image
# and never committed; a missing or expired key fails loudly at the first
# analysis (MSG:5021 / 5052 / 5055) rather than silently returning no
# titles.
ENV MUX_MAGIC_MAKEMKV_HOME=/makemkv-config
RUN mkdir -p /makemkv-config/.MakeMKV && chmod 777 /makemkv-config

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

# Server-owned persistent state (saved sequence templates, queued webhook
# deliveries) lives in APP_DATA_DIR, which defaults to /app/.config. Pre-create
# it so the first write never depends on a runtime mkdir, and make it
# world-writable so the container still works when run as a non-root user (a
# compose `user:` override) without a bind mount. This is what was behind the
# "Templates API 500" — a write into a directory the process couldn't create or
# write. For persistence across container recreation, bind-mount it
# (`-v app-data:/app/.config`) or point APP_DATA_DIR at a mounted volume.
RUN mkdir -p /app/.config && chmod 777 /app/.config

EXPOSE $PORT

# Single process. Node is PID 1 in the container; Docker's signal handling
# (use `docker run --init` or the orchestrator's `init: true` to install a
# minimal init like tini) propagates SIGTERM/SIGINT directly to Node.
CMD ["node", "--enable-source-maps", "packages/server/dist/index.js"]
