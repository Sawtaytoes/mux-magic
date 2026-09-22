# 2026-09-17 — Every `tsx` entry point resolves workspace packages from source

> [!NOTE]
> **Narrowed on 2026-09-22 by [The `tsx` source condition is private to this
> repo](2026-09-22-the-tsx-source-condition-is-private-to-this-repo.md).**
> This decision stands. Only the name of the condition changed: the flag is
> `--conditions=mux-magic-source`, because `source` is a shared name that also
> re-points third-party packages and broke the Docker build for five days. Read
> the two together, and take the flag from the newer file.

- **Status:** Accepted
- **Date:** 2026-09-17
- **Type:** infra
- **Supersedes:** —
- **Superseded by:** —

## Decision

Every script that runs the repo under `tsx` passes **`--conditions=source`**, so Node
selects the `"source"` condition already declared in `packages/tools/package.json`'s
`exports` map and loads `packages/tools/src/index.ts` instead of
`packages/tools/dist/index.js`.

    "cli":   "tsx --conditions=source src/cli.ts"
    "start": "tsx --conditions=source src/index.ts"
    "dev":   "node --conditions=source --import tsx --watch-path=… src/index.ts"

`packages/tools` is the **only** workspace with a `main`/`exports` pointing at a build
output; every other package already resolves from source. So a dev checkout now needs
no build step at all, and `yarn build:tools` is required only for the two things that
genuinely consume the build artefact: the Docker image and the npm publish.

## Context

`@mux-magic/tools` resolves to `./dist/index.js`, and nothing in a local install
produces that file. `packages/tools/package.json` declares `prepack` — which Yarn runs
only when packing for publish — and no install-time hook. The Dockerfile papers over it
with an explicit `RUN yarn build:tools` (line 104) before `yarn build:prod`, so the
**container has never been affected**. A source checkout has no such step, so
`packages/tools/dist` is whatever a previous session happened to leave behind.

On 2026-09-17 that surfaced in the shared `/mnt/TrueNAS-Apps/Repos/mux-magic` checkout.
`dist` had been built on 2026-07-05 and therefore predated `aclSafeCopyFolder`, so every
CLI command died before reaching argument parsing:

    SyntaxError: The requested module '@mux-magic/tools' does not provide
    an export named 'aclSafeCopyFolder'

The symptom is not a missing build — it is a build that is **present and silently two
months old**. `yarn install` reports success, `yarn typecheck` passes (it reads `src`),
and the tests pass (Vitest reads `src` too). Only the `tsx` entry points are wrong, and
only at runtime.

## Why

`--conditions=source` fixes the cause rather than the symptom, and it needs no new
tooling: the `"source"` condition is already in the exports map, put there by whoever
wrote it for exactly this purpose, and nothing was reading it.

It also repairs a second thing that had been quietly dead. `packages/server`'s `dev`
script watches `--watch-path=../tools/src`, which can only have been written in the
belief that dev ran tools from source. It did not — it ran `dist` — so edits under
`packages/tools/src` restarted the server and changed nothing. The watch path now means
what it says.

## What we rejected — DO NOT revert to this

**Do not add an install-time build hook to `packages/tools`.** `"prepare": "yarn build"`
was the obvious fix and it does not work: measured against this repo's own
`yarn@4.14.1`, Yarn 4 does **not** run a workspace's `prepare` on install, and does not
run the root workspace's `prepare` either. Only `postinstall` fires. And
`"postinstall": "yarn build"` would **break the Docker build**: the cache-friendly
install layer copies only the `package.json` files and runs `yarn install --immutable`
before `COPY . .`, so `packages/tools/src` does not exist yet and `tsc` would fail at
that line. Anything of the form `tsc … || true` is worse again — it converts a hard
failure into the same stale-`dist` silence this record exists to remove.

**Do not chain a build onto the CLI** (`"cli": "yarn build:tools && tsx src/cli.ts"`).
It works, but it pays a full `tsc` on every invocation of a batch tool that gets run in
loops.

**Do not point `exports["."].default` at `src`.** Production runs the esbuild bundle and
the npm package ships `dist`; see
[2026-07-01-prod-runs-esbuild-bundle-not-tsx.md](2026-07-01-prod-runs-esbuild-bundle-not-tsx.md).
The build artefact stays the default; only the `tsx` entry points opt out of it.

**Do not delete the Dockerfile's `RUN yarn build:tools`.** It is still the step that
produces the artefact the bundle and the published package need. It is now
belt-and-braces rather than the only thing keeping the repo working.

## Evidence

Yarn lifecycle behaviour, measured in a throwaway workspace using this repo's own
`.yarn/releases/yarn-4.14.1.cjs`, `nodeLinker: node-modules`, `enableScripts: true`:

| Hook | Runs on `yarn install`? |
| --- | --- |
| workspace `prepare` | **no** |
| workspace `postinstall` | **yes** |
| root `prepare` | **no** |

Resolution, from `packages/cli`:

    $ node -e "console.log(import.meta.resolve('@mux-magic/tools'))"
    file:///…/packages/tools/dist/index.js

    $ node --conditions=source -e "console.log(import.meta.resolve('@mux-magic/tools'))"
    file:///…/packages/tools/src/index.ts

And the package really loads from source, with the export whose absence caused the
failure:

    $ NODE_OPTIONS=--conditions=source node --import tsx -e \
        "import('@mux-magic/tools').then((m) => console.log(typeof m.aclSafeCopyFolder, Object.keys(m).length))"
    function 48

`renameDemos` then ran end to end on the source path and renamed a demo clip correctly.
