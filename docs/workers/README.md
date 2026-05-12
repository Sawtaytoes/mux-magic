# Worker Manifest — Mux-Magic Huge Revamp

This is the live tracking document for all workers in the Mux-Magic huge revamp. The full plan lives at [`C:\Users\satur\.claude\plans\claude-huge-revamp-idempotent-otter.md`](../../../../C:/Users/satur/.claude/plans/claude-huge-revamp-idempotent-otter.md) (local path on user's machine).

## How to use this file

- **Workers:** update your own row's `Status` column at start (`in-progress`) and end (`done`) — that's all you edit here. Everything else in your row is set when the prompt file was written.
- **Spawning a worker:** open the worker's prompt file at `docs/workers/<id>_<slug>.md`, paste the contents into a fresh Claude Code session, and let it run.
- **Adding a new worker mid-plan:** pick the next unused 2-hex code (sequential), add a row in the appropriate phase section, and create the prompt file. Never renumber existing workers.
- **Parallelism rule:** workers in the same phase may run in parallel iff their file-glob domains don't overlap. Phase 1A is strictly serial (all touch `eslint.config.js`); the rest of Phase 1B fans out across web/other/cross-repo tracks.

## Status values

| Status | Meaning |
|---|---|
| `planned` | Row exists, prompt file may or may not be written yet |
| `ready` | Prompt file written; can be spawned |
| `in-progress` | Worktree exists; work is happening |
| `blocked` | Has a `Depends on` not yet satisfied OR ran into a question for the user |
| `done` | PR merged into `feat/mux-magic-revamp` |

## Tracks

| Track | Owns |
|---|---|
| `shared` | `packages/shared/**`, root configs, `.github/**`, top-level docs, `AGENTS.md` |
| `web` | `packages/web/**` only |
| `srv` | `packages/server/**` only |
| `cli` | `packages/cli/**` (new package created in Phase 2) |
| `cross` | `<media-sync-renamed>` repo + cross-repo coordination |
| `infra` | CI, vitest configs, playwright config, ESLint/Biome configs |

---

## Phase 0 — Rebrand foundation (parallel; ⇒ merges to master)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 01 | [mux-magic-rename](01_mux-magic-rename.md) | shared | Sonnet | High | ON | — | ready |
| 02 | [npm-publish-key-setup](02_npm-publish-key-setup.md) | shared | Haiku | Low | OFF | — | ready |
| 03 | [storybook-vitest-filter-fix](03_storybook-vitest-filter-fix.md) | infra | Sonnet | Medium | ON | — | ready |
| 04 | [worker-conventions-agents-md](04_worker-conventions-agents-md.md) | shared | Haiku | Low | OFF | — | ready |

**Spawn recommendation:** start `02`, `03`, `04` in parallel (each touches small, disjoint files). Run `01` (full rename pass) AFTER they all merge, to avoid AGENTS.md / GitHub-Actions churn.

---

## Phase 1A — High-blast-radius ESLint config (serial)

All three workers touch `eslint.config.js` and must run sequentially.

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 05 | `is-has-eslint-rule` | infra | Sonnet | Medium | ON | 01 | planned |
| 06 | `webtypes-eslint-guard` | infra | Sonnet | Medium | ON | 05 | planned |
| 07 | `one-component-per-file` | infra | Sonnet | Medium | ON | 06 | planned |

---

## Phase 1B — Independent improvements (parallel fan-out)

### Web track (16 workers)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 08 | `language-fields-and-tagify` | web | Sonnet | Medium | ON | 01 | planned |
| 09 | `number-fields-redesign` | web | Sonnet | Medium | ON | 01 | planned |
| 0a | `json-field-readonly` | web | Haiku | Low | OFF | 01 | planned |
| 0b | `auto-paste-yaml` | web | Haiku | Low | OFF | 01 | planned |
| 0c | `scale-resolution-aspect-lock` | web | Sonnet | Medium | ON | 01 | planned |
| 0d | `narrow-view-menu-animate` | web | Sonnet | Medium | ON | 01 | planned |
| 0e | `story-actions-and-reopen` | web | Haiku | Low | OFF | 01 | planned |
| 0f | `undo-redo-scroll-to-affected` | web | Sonnet | Medium | ON | 01 | planned |
| 10 | `apirunmodal-rename` | web | Haiku | Low | OFF | 01 | planned |
| 11 | `limit-execution-threads-ui` | web+srv | Sonnet | Medium | ON | 01 | planned |
| 12 | `sequence-jobs-formatting` | web | Haiku | Low | OFF | 01 | planned |
| 13 | `merge-subtitles-offsets-label` | web | Haiku | Low | OFF | 01 | planned |
| 14 | `dryrun-to-query-string` | web | Sonnet | Medium | ON | 01 | planned |
| 15 | `dry-run-silent-failures` | web | Sonnet | Medium | ON | 01 | planned |
| 16 | `user-event-migration` | web | Sonnet | High | ON | 01 | planned |
| 17 | `run-in-background-sequence-modal` | web | Sonnet | High | ON | 10 | planned |

### Other track (3 workers)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 18 | `loadenvfile-migration` | infra | Haiku | Low | OFF | 01 | planned |
| 19 | `yaml-codec-merge` | web | Sonnet | Medium | ON | 01 | planned |
| 1a | `reorder-tracks-skip-on-misalignment` | srv+web | Sonnet | Medium | ON | 01 | planned |

### Cross-repo track (5 workers)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 1b | `media-sync-rename` | cross | Sonnet | High | ON | 01 | blocked (new name TBD) |
| 1c | `media-sync-decouple-and-ha-endpoint` | cross | Sonnet | High | ON | 1b | planned |
| 1d | `media-sync-consume-mux-magic-shared` | cross | Sonnet | Medium | ON | 1c, 02 | planned |
| 1e | `mux-magic-webhook-reporter` | srv | Sonnet | Medium | ON | 01 | planned |
| 1f | `mux-magic-anime-manga-commands` | srv+web | Sonnet | High | ON | 01 | planned |

---

## Phase 2 — CLI extraction (serial)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 20 | `cli-package-extract` | cli | **Opus** | High | ON | All Phase 1 done | planned |
| 21 | `observables-shared-split` | cli | Sonnet | High | ON | 20 | planned |

---

## Phase 3 — Name Special Features overhaul

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 22 | `nsf-vendor-postfix-rename` | srv+web | Sonnet | Medium | ON | 21 | planned |
| 23 | `nameMovieByDb-new-command` | srv+web | Sonnet | High | ON | 22 | planned |
| 24 | `source-path-abstraction` | srv+web | **Opus** | High | ON | All Phase 1 done | planned |
| 25 | `nsf-fix-unnamed-overhaul` | srv+web | Sonnet | High | ON | 22 | planned |
| 26 | `nsf-edition-organizer` | srv+web | Sonnet | High | ON | 25 | planned |
| 27 | `nsf-cache-state-persistence` | srv+web | Sonnet | High | ON | 25 | planned |

---

## Phase 4 — Server infrastructure

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 28 | `structured-logging-otel` | srv+cli | **Opus** | High | ON | 21 | planned |
| 29 | `openapi-codegen-optional` | srv+infra | Sonnet | Medium | ON | 01 | planned |
| 2a | `server-template-storage` | srv+web | Sonnet | High | ON | 01 | planned |
| 2b | `error-persistence-webhook` | srv | Sonnet | Medium | ON | 28 | planned |
| 2c | `pure-functions-sweep` | srv+web | Sonnet | High | ON | 20 | planned |
| 2d | `asset-fallback-to-cli` | srv | Haiku | Low | OFF | 01 | planned |

---

## Phase 5 — HA + advanced features (parallel)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 2e | `trace-moe-anime-split` | srv+web | Sonnet | High | ON | 24 | planned |
| 2f | `ffmpeg-gpu-reencode-endpoint` | srv | **Opus** | High | ON | 28 | planned |
| 30 | `gpu-aspect-ratio-multi-gpu` | srv | Sonnet | Medium | ON | 01 | planned |
| 31 | `duplicate-manga-detection` | srv | Sonnet | Medium | ON | 1d | planned |
| 32 | `command-search-tags` | web | Haiku | Low | OFF | 22 | planned |

---

## Phase 6 — Final consolidation (⇒ merges to master)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 33 | `final-merge-and-cleanup` | shared | Sonnet | Medium | ON | All Phase 5 done | planned |

---

## Open Questions blocking specific workers

| Worker | Question |
|:--:|---|
| 1b | What's the final new name for the renamed Media-Sync? Candidates: Gallery-Downloader, Image-Downloader, Comic-Downloader, or a fancier alternative. |
| 22 | Rename `nameSpecialFeatures` to single `nameSpecialFeaturesDvdCompare` OR split into `nameMovieCutsDvdCompare` + `nameSpecialFeaturesDvdCompare`? |
| 27 | 1-word name for the new "awaiting user input" job state? Options: `awaiting-input`, `paused`, `held`, `interactive`. |
| 11 | Server-side thread-cap persistence: `settings.json`, sqlite, or new server config endpoint? |
| 2f | FFmpeg GPU re-encode model: keep Opus or downgrade to Sonnet/High? |
| 24 | SourcePath field naming: `sourcePath`, `inputPath`, or `source`? Touches every command schema. |
| 33 | Final verification beyond standard gates? Manual user-test per phase deliverable? Docker dry-run? |
