FROM node:24-slim
WORKDIR /app

# Set up locales
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NODE_ENV=production
ENV PORT=3000

RUN log() { echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1"; };

# Install the application dependencies. Note: the system 'chromium' apt
# package is intentionally NOT installed — Playwright manages its own
# Chromium binary (downloaded by `npx playwright install --with-deps`
# below, which also pulls the required system libs).
RUN \
  touch .env && \
  apt update && \
  apt install -y --no-install-recommends build-essential ca-certificates ffmpeg git locales mediainfo pipx procps python3 wget && \
  \
  sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen && \
  \
  update-ca-certificates && \
  \
  wget -O /etc/apt/keyrings/gpg-pub-moritzbunkus.gpg https://mkvtoolnix.download/gpg-pub-moritzbunkus.gpg && \
  echo "deb [signed-by=/etc/apt/keyrings/gpg-pub-moritzbunkus.gpg] https://mkvtoolnix.download/debian/ bookworm main" > /etc/apt/sources.list.d/mkvtoolnix.download.list && \
  \
  apt update && \
  apt install -y --no-install-recommends mkvtoolnix

# Add Python dependencies
COPY requirements.txt ./

# Install audio-offset-finder
RUN \
  pipx install audio-offset-finder && \
  pipx ensurepath

# Install Node.js dependencies
COPY .yarn/patches .yarn/patches
COPY . .

RUN \
  npm install -g -y corepack@latest && \
  corepack enable yarn && \
  yarn install

# Playwright Chromium binary + the matching apt-level system libs
# (libnss3, libxkbcommon0, fonts, etc.). Has to run AFTER yarn install
# so the playwright CLI is on disk; --with-deps invokes apt under the
# hood, which is fine since the Docker image runs as root.
RUN yarn install-playwright-browser --with-deps chromium

EXPOSE $PORT

# yarn start-server resolves to:
#   tsx --env-file ./.env packages/server/src/server.ts
# (root package.json), so the monorepo restructure is invisible to the
# container — the CMD line stays the same as the pre-migration image.
CMD ["yarn", "start-server"]
