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
| `PUBLIC_URL` | unset | Public base URL used in generated API documentation. Its origin may also call the API from a browser. |
| `CORS_ALLOWED_ORIGINS` | unset | Comma-separated extra browser origins that may call the API. The web interface is same-origin and needs no entry. A browser request that changes state from any other origin is refused with 403. Clients that send no `Origin` header, such as curl, are not checked against this list. |
| `ALLOWED_HOSTS` | unset | Comma-separated host names this server answers to, besides `localhost`: its public name and its LAN address, for example `media.example.com,192.0.2.10:3000`. An entry with a port matches that port only. With a list, a request on any other `Host` gets 421, reads included. **An empty list refuses every change from a non-loopback host unless `NODE_ENV` is `development` or `test`**, so set it before you deploy or before you open the app from another machine. A change must send `Content-Type: application/json`; for `curl`, add `-H 'Content-Type: application/json'`, even to a `POST` with no body. |

### Data and metadata

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANIDB_CACHE_FOLDER` | `./.cache/anidb` | AniDB and anime database cache. Use a persistent path in a container. |
| `APP_DATA_DIR` | `./.config` | Saved templates and other server-owned state. Use a persistent path in a container. |
| `TMDB_API_KEY` | unset | TMDB v4 read-access token for movie and television metadata. |
| `TVDB_API_KEY` | unset | TVDB API key for television episode metadata. |
| `MEDIAINFO_PATH` | platform default | Host path to the MediaInfo command for a source installation. |

### File deletion

`ALLOWED_FILE_ROOTS` limits where the file explorer and the music routes may delete, rename, move, or write files. Commands and sequence steps are refused when a path parameter is outside the roots, but this checks the parameters only: a path a command builds or finds later, such as the parent folder that `flattenOutput` writes into or a linked folder found while walking a tree, is not checked again. It is a list of absolute paths, split by `:` on Linux and macOS and by `;` on Windows. When it is unset, the container image is limited to `/media`, and a source installation has no limit. Reading and listing files are not limited.

`DELETE_MODE` accepts `trash` or `permanent`. The default is `trash`. Permanent deletion cannot be undone by Mux Magic. Windows network paths use permanent deletion when the Recycle Bin is unavailable, even when the global mode is `trash`.

### Optional integrations

The `.env.example` file documents the outbound job webhook variables and the music tagging variables. Leave an integration variable unset to disable that integration.

Disc analysis uses the MakeMKV tools that are included in the container. Mount a valid MakeMKV settings file below `/makemkv-config/.MakeMKV/` when your installation requires a registration key.

## Run from source

Requirements:

- Node.js 22 or later.
- pnpm 12.9.1.
- `ffmpeg`, `mkvtoolnix`, and `mediainfo` on `PATH`.
- Python 3 for legacy helpers.

```sh
npm install --global --force --allow-scripts=pnpm pnpm@12.9.1
pnpm install
cp .env.example .env
pnpm dev
```

Edit `.env` only for the credentials and settings that you use. Do not commit that file.

See [Local development](development.md) for repository commands and test requirements.

## First-run checks

1. Open the web interface and confirm that the Jobs view loads.
2. Open `/api/version` and confirm that it returns JSON.
3. Run a read-only inspection command against a test directory.
4. Confirm the mount path and output before you run a command that changes files.
