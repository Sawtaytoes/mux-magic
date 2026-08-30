# Mux Magic

![Mux Magic logo](docs/images/mux-magic-logo.png)

Mux Magic is a self-hosted media operations server and command-line toolkit. It can inspect, rename, remux, and reorganize media files through repeatable jobs and multi-step sequences.

**[Set up Mux Magic with Docker →](docs/setup.md)**

## What it provides

- A web interface for jobs, logs, and reusable sequence templates.
- A REST API for commands, job control, and live progress events.
- A CLI for direct local operation.
- Media workflows for MKV tracks, subtitles, disc titles, naming, audio, and metadata.
- Sequence templates that can be stored as YAML or shared through a URL.

Most operations modify files. Mount media with write access and keep a backup or snapshot before the first run.

## Quick start

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

Open `http://localhost:3000`. See the [setup guide](docs/setup.md) before you add metadata credentials or enable permanent deletion.

## Documentation

- [Setup and configuration](docs/setup.md)
- [Web interface](docs/interface.md)
- [REST API and sequence runner](docs/api.md)
- [CLI commands](docs/cli.md)
- [Local development](docs/development.md)
- [Operation guides](docs/combining-two-releases.md)
- [Architecture decisions](docs/decisions/README.md)

## Development

```sh
corepack yarn install
corepack yarn dev
```

The web interface, API, and Storybook use one port. The default address is `http://localhost:3000`.
