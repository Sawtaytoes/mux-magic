# 2026-09-22 — The `tsx` source condition is private to this repo

- **Status:** Accepted
- **Date:** 2026-09-22
- **Type:** infra
- **Supersedes:** —
- **Superseded by:** —
- **Source:** PR #305 — narrows [2026-09-17](2026-09-17-tsx-entry-points-resolve-workspace-packages-from-source.md)

## Decision

Every `tsx` and `node` entry point passes **`--conditions=mux-magic-source`**, not
`--conditions=source`. `packages/tools/package.json` declares `mux-magic-source`
beside the `source` it already had, pointing at the same files.

    "cli":   "tsx --conditions=mux-magic-source src/cli.ts"
    "start": "tsx --conditions=mux-magic-source src/index.ts"

This keeps everything the 2026-09-17 decision bought. That record still stands; only
the name of the condition changes.

## Context

`Docker Deploy` failed on every push to `master` from 2026-09-17 (#303) to 2026-09-22
(#305). Five days, four merges, and the image the household runs stayed on the
2026-09-16 build. #303 added `--conditions=source` to every `tsx` entry point so a dev
checkout needs no `yarn build:tools`. That part works and stays.

An export condition is a global name. `@internationalized/date` declares `"source"`
too, so the same flag re-pointed it at its TypeScript barrel.

## What we rejected — DO NOT revert to this

**Do not pass `--conditions=source`.** An export condition is a global name, not a
private one, and it re-points **every** package in `node_modules` that declares it.
`@internationalized/date` declares `"source": "./src/index.ts"`, so under that flag
Node loads its TypeScript barrel and hands back **2** named exports instead of 63.
`radix-vue` imports `endOfYear` from it, `@scalar/components` imports `radix-vue`, and
the API schema generator imports Scalar, so:

    SyntaxError: The requested module '@internationalized/date'
    does not provide an export named 'endOfYear'

**Do not "fix" this by pinning `@internationalized/date`.** That was the first reading
and it is wrong. 3.12.0 did delete the `endOfYear` and `startOfYear` named exports in a
minor, which looks like the cause, but pinning back to 3.11.0 changes nothing: the flag
never reaches `dist/import.mjs` in either version. Measured on both.

**Do not remove `source` from `packages/tools`.** It is published, and an outside
consumer may already read that condition. The two names sit side by side and resolve
to the same file.

## Why

`Docker Deploy` failed on every push to `master` from 2026-09-17 (#303) to 2026-09-22
(#305) — five days, four merges — and the image the household runs stayed on the
2026-09-16 build. Nothing else caught it: `yarn build:prod` bundles, so a bundler
resolves the same import and never asks Node for a named export; `yarn typecheck` reads
`src`; the tests read `src`. Only `Docker Deploy` runs `generate:schemas-ci`, and only
on `master`, after the merge.

## Evidence

A probe inside `packages/api`, on the same install:

    tsx --conditions=source           probe.ts  →  keys: 2  endOfYear: false
    tsx                               probe.ts  →  keys: 63 endOfYear: true
    tsx --conditions=mux-magic-source probe.ts  →  keys: 63 endOfYear: true

And with `packages/tools/dist` deleted — the case the 2026-09-17 record exists for —
`yarn generate:schemas-ci` completes under the new flag.
