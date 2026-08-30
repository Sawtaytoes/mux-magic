# Setup

The container image includes the media utilities that Mux Magic needs. A source installation needs those utilities on the host.

## Run the container

```sh
docker run -d --init --name mux-magic \
  -p 3000:3000 \
  -e MAX_THREADS=2 \
  -e ANIDB_CACHE_FOLDER=/cache/anidb \
  -e APP_DATA_DIR=/app/.config \
  -v /path/to/media:/media \
  -v mux-magic-anidb:/cache/anidb \
  -v mux-magic-data:/app/.config \
  ghcr.io/sawtaytoes/mux-magic:latest
```

Replace `/path/to/media` with an absolute host path. Mux Magic needs write access because many commands change files in place.

Open `http://localhost:3000`. Check `http://localhost:3000/api/version` to verify the API, or open `http://localhost:3000/api/docs` for the generated API reference.

## Docker Compose

```yaml
services:
  mux-magic:
    image: ghcr.io/sawtaytoes/mux-magic:latest
    init: true
    ports:
      - "3000:3000"
    environment:
      MAX_THREADS: "2"
      ANIDB_CACHE_FOLDER: /cache/anidb
      APP_DATA_DIR: /app/.config
    volumes:
      - /path/to/media:/media
      - mux-magic-anidb:/cache/anidb
      - mux-magic-data:/app/.config

volumes:
  mux-magic-anidb:
  mux-magic-data:
```

The AniDB volume avoids a repeated metadata download after container replacement. The app-data volume preserves sequence templates and queued webhook deliveries.

## Configuration

All settings are optional. The complete commented list is in [`.env.example`](../.env.example).

### Server and workload

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port for the web interface, API, and Storybook. |
| `MAX_THREADS` | CPU thread count | Global command concurrency limit. Use a lower value on a small host. |
| `DEFAULT_THREAD_COUNT` | `2` | Default task concurrency claim for each sequence job. |
| `MAX_TRANSCODE_CONCURRENCY` | `4` | Concurrent audio transcodes for browser playback. |
| `TRANSCODE_CACHE_MAX_BYTES` | `4294967296` | Maximum temporary transcode cache size in bytes. |
| `PUBLIC_URL` | unset | Public base URL used in generated API documentation. |

### Data and metadata

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANIDB_CACHE_FOLDER` | `./.cache/anidb` | AniDB and anime database cache. Use a persistent path in a container. |
| `APP_DATA_DIR` | `./.config` | Saved templates and other server-owned state. Use a persistent path in a container. |
| `TMDB_API_KEY` | unset | TMDB v4 read-access token for movie and television metadata. |
| `TVDB_API_KEY` | unset | TVDB API key for television episode metadata. |
| `MEDIAINFO_PATH` | platform default | Host path to the MediaInfo command for a source installation. |

### File deletion

`DELETE_MODE` accepts `trash` or `permanent`. The default is `trash`. Permanent deletion cannot be undone by Mux Magic. Windows network paths use permanent deletion when the Recycle Bin is unavailable, even when the global mode is `trash`.

### Optional integrations

The `.env.example` file documents the outbound job webhook variables and the music tagging variables. Leave an integration variable unset to disable that integration.

Disc analysis uses the MakeMKV tools that are included in the container. Mount a valid MakeMKV settings file below `/makemkv-config/.MakeMKV/` when your installation requires a registration key.

## Run from source

Requirements:

- Node.js 22 or later.
- Corepack and Yarn 4.
- `ffmpeg`, `mkvtoolnix`, and `mediainfo` on `PATH`.
- Python 3 for legacy helpers.

```sh
corepack yarn install
cp .env.example .env
corepack yarn dev
```

Edit `.env` only for the credentials and settings that you use. Do not commit that file.

See [Local development](development.md) for repository commands and test requirements.

## First-run checks

1. Open the web interface and confirm that the Jobs view loads.
2. Open `/api/version` and confirm that it returns JSON.
3. Run a read-only inspection command against a test directory.
4. Confirm the mount path and output before you run a command that changes files.
