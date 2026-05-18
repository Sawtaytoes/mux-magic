# Local development

## Prerequisites

- **Node.js** 22+
- **Yarn** 4+
- **Python 3** (for some legacy helpers)
- External binaries on `PATH`: `mkvtoolnix`, `ffmpeg`, `mediainfo`

## Installation

```sh
yarn install
yarn dlx @yarnpkg/sdks vscode   # one-time VS Code SDK setup
```

Copy `.env.example` to `.env` and set any environment variables you need (e.g. `PORT`, `TMDB_API_KEY`). See the [configuration table](../MANIFEST.md#configuration) for all options.

---

## Start the server

```sh
yarn dev                   # single front-door on port 3000 (SPA + /api + /storybook)
PORT=8080 yarn dev         # custom port
```

The dev script (`yarn workspace @mux-magic/server dev`) spawns one process: Hono root that proxies `/api/*` in-process to the api sub-app, runs Vite in middleware mode at `/` for the SPA (HMR over the same port), and spawns a Storybook child that's reverse-proxied at `/storybook/*`.

---

## Common commands

```sh
yarn test          # run all tests (vitest)
yarn typecheck     # TypeScript type check without emitting
yarn build:cli-app # bundle CLI to build/mux-magic.cjs (used by `yarn sea`)
```

Tests live next to their source files (`foo.ts` → `foo.test.ts`). The filesystem is globally mocked with `memfs` in tests — see `vitest.setup.ts`.

---

## Regenerating screenshots

Start the server (`yarn dev`) then run `yarn screenshots`. This launches headless Chromium with `?mock=1` (MSW fake-data mode — no real files needed) and writes PNGs to `docs/images/`. Playwright Chromium must be installed first:

```sh
yarn install-playwright-browser
```
