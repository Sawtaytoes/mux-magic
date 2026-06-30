# 2026-05-13 — Rebrand: media-tools → mux-magic; `@media-tools` retired

- **Status:** Accepted
- **Date decided:** 2026-05-13
- **Area:** naming
- **Source:** worker 01, commit `55b384c0` (PR #79); worker 39 `d82c96f5` (packages/shared → packages/tools)

## Decision

The project's name is **`mux-magic`** (with the hyphen). The npm scope is `@mux-magic/*`. CLI binaries are `mux-magic.cjs` / `mux-magic.exe`; the GHCR namespace is `ghcr.io/sawtaytoes/mux-magic`; the transcode temp dir is `mux-magic-transcode-cache`. The reusable package is `packages/tools/` published as `@mux-magic/tools` (renamed from `packages/shared/` in worker 39). The companion repo was renamed `media-sync` → `gallery-downloader` (worker 1b).

## What we rejected — DO NOT revert to this

The old `@media-tools/*` npm scope, `media-tools.*` binary names, `packages/shared/`, and the `media-sync` / `mediaToolsApi` companion names are **abandoned**. A future agent will encounter stray `media-tools` / `media-sync` strings in old commits and the legacy local directory names (`d:\Projects\Personal\media-tools`) — do **not** treat those as canonical or "fix" current names back toward them. `mux-magic` is the brand.

## Why it must not be re-litigated

This was a multi-worker rebrand that shipped and published to npm. Reintroducing `media-tools` naming anywhere (imports, scopes, binaries, docs) re-opens a finished migration and breaks published-package consumers like gallery-downloader that now depend on `@mux-magic/tools`. Even earlier the project had other names (the user recalls "media-tools" and possibly a "disc-features"-ish name before that); none of those are canonical.
