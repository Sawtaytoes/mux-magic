# Mux Magic

![Mux Magic logo](docs/images/mux-magic-logo.png)

A Node.js toolkit for batch media file operations:

- MKV track manipulation
- file renaming
- subtitle merging
- aspect ratio analysis
- ...and much, much more!

Ships as both a **[CLI](docs/cli.md)** and a multi-tenant **[REST API](docs/api.md)** (now preferred).

## Why I built it

I've been using this library ever since I started purchasing physical media in 2023. I never liked the physical nature of it, so I rip everything I buy. Sadly, there aren't any good tools for ingesting that stuff, so I wrote my own!

I use this all the time for:

1. Naming special features, anime, and TV show episodes from disc rips.
1. Removing non-English or non-Japanese languages to save on space (especially now that storage costs are only going up).
1. Muxing fansubs into my Japanese anime import rips with time-alignment (this feature is so important!).

## New API mode

In the past, this was just a CLI runner, and while I had a Docker container, I was using a CLI in the browser to run things commands 1-by-1.

Since building out the API, it now includes significantly better visibility, it lets you build sequences and share those sequence templates around, and

---

### Jobs

![Jobs overview showing running, completed, and failed jobs](docs/images/jobs-overview.png)

### Sequence Builder

![Sequence Builder with a multi-step pipeline](docs/images/sequence-builder-overview.png)

You can run a huge sequence of steps like this (I use this):
![Sequence Builder with steps collapsed](docs/images/sequence-builder-collapsed.png)

And then you can grab the YAML and share it around. It's also stored in the URL's query string, so copy-pasting a link works too if you wanna share around your templates!

---

## Quick start with Docker

```sh
docker run -d --init \
  -p 3000:3000 \
  -e MAX_THREADS=2 \
  -e ANIDB_CACHE_FOLDER=/cache/anidb \
  -e TMDB_API_KEY=your-key-here \
  -v /your/media-library:/media \
  -v anidb-cache:/cache/anidb \
  -v app-data:/app/.config \
  mux-magic
```

The UI is available at `http://localhost:3000`. The API is mounted under `/api` at the same origin (so `http://localhost:3000/api/version`, `http://localhost:3000/api/docs`).

### Docker Compose

```yaml
services:
  mux-magic:
    image: mux-magic
    init: true
    ports:
      - "3000:3000"
    environment:
      MAX_THREADS: 2
      DELETE_TO_TRASH: "false"
      ANIDB_CACHE_FOLDER: /cache/anidb
      TMDB_API_KEY: your-key-here
    volumes:
      - /your/media-library:/media
      - anidb-cache:/cache/anidb
      - app-data:/app/.config

volumes:
  anidb-cache:
  app-data:
```

> **Volume note.** Mount your media library at `/media` — write access is required since most commands modify files in place. The `anidb-cache` named volume ensures the AniDB metadata cache survives container restarts — without it, the ~60 MB dataset re-downloads on every start. The `app-data` volume holds server-owned state (saved sequence templates) at `/app/.config`; without it your templates are lost when the container is recreated. The directory is pre-created and writable in the image, so a fresh `docker run` works without it — the volume is only needed for persistence (or if you run the container read-only or as a non-root user, in which case bind-mount a writable path here).

---

## Configuration

All environment variables are optional. Set them in `.env` or pass them to the container:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Single port for the SPA, the API (under `/api`), and Storybook (under `/storybook`). |
| `MAX_THREADS` | CPU thread count | Concurrent thread limit for all commands. **Important for lower-end systems** — set to 2–4 to reduce memory/CPU usage. |
| `DELETE_TO_TRASH` | `true` | Send deleted files to trash instead of permanent deletion. Set to `false` for immediate deletion. |
| `MAX_TRANSCODE_CONCURRENCY` | `4` | Maximum number of concurrent audio transcode jobs (for browser audio playback fallback). Lower this on resource-constrained systems. |
| `TRANSCODE_CACHE_MAX_BYTES` | `4294967296` (4 GB) | Maximum size of the transcode cache directory. Cache lives in `os.tmpdir()/media-tools-transcode-cache/`. |
| `ANIDB_CACHE_FOLDER` | `./.cache/anidb` | Cache directory for AniDB metadata. **In Docker, set this to a mounted volume** so cache survives restarts (e.g., `/cache/anidb`). |
| `APP_DATA_DIR` | `./.config` (`/app/.config` in Docker) | Directory for server-owned persistent state (saved sequence templates, queued webhook deliveries). Pre-created and writable in the image; **mount a volume here** so saved templates survive container recreation. |
| `TMDB_API_KEY` | — | The Movie Database API key for movie/TV metadata lookup. Get one free at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api). |
| `PUBLIC_URL` | — | Public-facing base URL (e.g. `https://media.example.com`). Used for canonical absolute URLs in the OpenAPI / Scalar docs page. The SPA itself talks to the API via relative `/api`, so this is not needed unless you want pretty docs URLs. |
| `MEDIA_TOOLS_FAKE_DATA` | — | Set to `true` or `1` to populate the UI with mock data (useful for development/screenshots). |

---

## Usage Docs

- [REST API & Sequence Runner](docs/api.md)
- [CLI commands](docs/cli.md)
- [Local development](docs/development.md)
