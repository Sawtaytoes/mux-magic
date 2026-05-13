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
| `planned` | Row exists, prompt file not yet written |
| `ready` | Prompt file written; can be spawned |
| `in-progress` | Worktree exists; work is happening |
| `blocked` | Has a `Depends on` not yet satisfied OR ran into a question for the user |
| `done` | PR merged into `feat/mux-magic-revamp` |

## Tracks

| Track | Owns |
|---|---|
| `tools` | `packages/tools/**` (renamed from `packages/shared/**` in worker 39), root configs, `.github/**`, top-level docs, `AGENTS.md` |
| `web` | `packages/web/**` only |
| `srv` | `packages/server/**` only |
| `cli` | `packages/cli/**` (new package created in Phase 2) |
| `cross` | `Gallery-Downloader` repo (formerly `Media-Sync`) + cross-repo coordination |
| `infra` | CI, vitest configs, playwright config, ESLint/Biome configs |

---

## Phase 0 — Rebrand foundation (parallel; ⇒ merges to master)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 39 | [shared-to-tools-rename](39_shared-to-tools-rename.md) | tools | Sonnet | High | ON | — | ready |
| 01 | [mux-magic-rename](01_mux-magic-rename.md) | tools | Sonnet | High | ON | 39 | done |
| 02 | [npm-publish-key-setup](02_npm-publish-key-setup.md) | tools | Haiku | Low | OFF | — | in-progress |
| 03 | [storybook-vitest-filter-fix](03_storybook-vitest-filter-fix.md) | infra | Sonnet | Medium | ON | — | done |
| 04 | [worker-conventions-agents-md](04_worker-conventions-agents-md.md) | tools | Haiku | Low | OFF | — | done |

**Spawn recommendation:** start `39`, `02`, `03`, `04` in parallel (each touches small, disjoint files; `39` owns the `packages/shared/` → `packages/tools/` rename plus selective migration of reusable utilities from `packages/server/src/tools/`). Run `01` (full rebrand pass) AFTER all four have merged, so `01` only renames `@media-tools/tools` → `@mux-magic/tools` (no leftover `@mux-magic/tools` references).

---

## Phase 1A — High-blast-radius ESLint config (serial)

All three workers touch `eslint.config.js` and must run sequentially.

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 05 | [is-has-eslint-rule](05_is-has-eslint-rule.md) | infra | Sonnet | Medium | ON | 01 | done |
| 06 | [webtypes-eslint-guard](06_webtypes-eslint-guard.md) | infra | Sonnet | Medium | ON | 05 | done |
| 07 | [one-component-per-file](07_one-component-per-file.md) | infra | Sonnet | Medium | ON | 06 | done |

---

## Phase 1B — Independent improvements (parallel fan-out)

### Foundation sub-chain (serial; blocks workers 11, 35, 37)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 36 | [variables-system-foundation](36_variables-system-foundation.md) | web | Sonnet | High | ON | 01 | done |
| 37 | [edit-variables-modal-and-sidebar](37_edit-variables-modal-and-sidebar.md) | web | Sonnet | Medium | ON | 36 | ready |

### Web track (16 workers)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 08 | [language-fields-and-tagify](08_language-fields-and-tagify.md) | web | Sonnet | Medium | ON | 01 | done |
| 09 | [number-fields-redesign](09_number-fields-redesign.md) | web | Sonnet | Medium | ON | 01 | done |
| 0a | [json-field-readonly](0a_json-field-readonly.md) | web | Haiku | Low | OFF | 01 | ready |
| 0b | [auto-paste-yaml](0b_auto-paste-yaml.md) | web | Haiku | Low | OFF | 01 | ready |
| 0c | [scale-resolution-aspect-lock](0c_scale-resolution-aspect-lock.md) | web | Sonnet | Medium | ON | 01 | ready |
| 0d | [narrow-view-menu-animate](0d_narrow-view-menu-animate.md) | web | Sonnet | Medium | ON | 01 | ready |
| 0e | [story-actions-and-reopen](0e_story-actions-and-reopen.md) | web | Haiku | Low | OFF | 01 | ready |
| 0f | [undo-redo-scroll-to-affected](0f_undo-redo-scroll-to-affected.md) | web | Sonnet | Medium | ON | 01 | done |
| 10 | [apirunmodal-rename](10_apirunmodal-rename.md) | web | Haiku | Low | OFF | 01 | ready |
| 11 | [limit-execution-threads-ui](11_limit-execution-threads-ui.md) — per-job thread cap as a `threadCount` Variable; adds `DEFAULT_THREAD_COUNT` env var; per-job quota enforcement in `taskScheduler.ts` | web+srv | Sonnet | High | ON | 01, 36 (Variables foundation) | ready |
| 12 | [sequence-jobs-formatting](12_sequence-jobs-formatting.md) | web | Haiku | Low | OFF | 01 | done |
| 13 | [merge-subtitles-offsets-label](13_merge-subtitles-offsets-label.md) | web | Haiku | Low | OFF | 01 | done |
| 14 | [dryrun-to-query-string](14_dryrun-to-query-string.md) | web | Sonnet | Medium | ON | 01 | done |
| 15 | [dry-run-silent-failures](15_dry-run-silent-failures.md) | web | Sonnet | Medium | ON | 01 | ready |
| 16 | [user-event-migration](16_user-event-migration.md) | web | Sonnet | High | ON | 01 | ready |
| 17 | [run-in-background-sequence-modal](17_run-in-background-sequence-modal.md) | web | Sonnet | High | ON | 10 | ready |

### Other track (3 workers)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 18 | [loadenvfile-migration](18_loadenvfile-migration.md) | infra | Haiku | Low | OFF | 01 | ready |
| 19 | [yaml-codec-merge](19_yaml-codec-merge.md) | web | Sonnet | Medium | ON | 01 | ready |
| 1a | [reorder-tracks-skip-on-misalignment](1a_reorder-tracks-skip-on-misalignment.md) | srv+web | Sonnet | Medium | ON | 01 | ready |

### Cross-repo track (5 workers)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 1b | [media-sync-rename-to-gallery-downloader](1b_media-sync-rename-to-gallery-downloader.md) | cross | Sonnet | High | ON | 01 | ready |
| 1c | [gallery-downloader-decouple-and-ha-endpoint](1c_gallery-downloader-decouple-and-ha-endpoint.md) | cross | Sonnet | High | ON | 1b | ready |
| 1d | [gallery-downloader-consume-mux-magic-tools](1d_gallery-downloader-consume-mux-magic-tools.md) | cross | Sonnet | Medium | ON | 1c, 02, 39 + a published `@mux-magic/tools` release | ready |
| 1e | [mux-magic-webhook-reporter](1e_mux-magic-webhook-reporter.md) | srv | Sonnet | Medium | ON | 01 | ready |
| 1f | [mux-magic-anime-manga-commands](1f_mux-magic-anime-manga-commands.md) | srv+web | Sonnet | High | ON | 01 | ready |

---

## Phase 2 — CLI extraction (serial)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 20 | `cli-package-extract` | cli | **Opus** | High | ON | All Phase 1 done | planned |
| 21 | `observables-shared-split` | cli | Sonnet | High | ON | 20 | planned |

---

## Phase 3 — Name Special Features overhaul

The existing `nameSpecialFeatures` code is preserved (renamed only). Two new sibling commands are added for narrower workflows, plus a shared "DVD Compare ID variable" concept that lets steps reference each other's lookup IDs (similar to path variables).

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 22 | `nsf-rename-to-dvdcompare-tmdb` — rename existing `nameSpecialFeatures` → `nameSpecialFeaturesDvdCompareTmdb`; **code unchanged** | srv+web | Sonnet | Medium | ON | 21 | planned |
| 23 | `nameMovieCutsDvdCompareTmdb-new-command` — new command: rename movies + move into directories by edition. Uses TMDB + DVD Compare | srv+web | Sonnet | High | ON | 22, 35 | planned |
| 24 | `source-path-abstraction` — unified `SourcePath` control (field name `sourcePath` internal, "Source Path" user-facing) | srv+web | **Opus** | High | ON | All Phase 1 done | planned |
| 25 | `nsf-fix-unnamed-overhaul` | srv+web | Sonnet | High | ON | 22 | planned |
| 26 | `nsf-edition-organizer` | srv+web | Sonnet | High | ON | 25 | planned |
| 27 | `nsf-cache-state-persistence` — adds `paused` job state with separate `reason` field (e.g. `reason: user_input`) | srv+web | Sonnet | High | ON | 25 | planned |
| 34 | `onlyNameSpecialFeaturesDvdCompare-new-command` — new command: non-movie variant (no TMDB needed) | srv+web | Sonnet | High | ON | 22, 35 | planned |
| 35 | `dvd-compare-id-variable` — registers `dvdCompareId` as a Variable type in the new system (multi-instance, named); adds "Step X DVD Compare ID" link picker. Generic pattern for future TMDB/AniDB ID types | srv+web | Sonnet | Medium | ON | 22, 36 (Variables foundation) | planned |

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
| 38 | [per-file-pipelining](38_per-file-pipelining.md) — rewire `sequenceRunner.ts` to stream files through steps via rxjs composition; file 1 hits step 3 while file 2 still on step 1. Multiplies value of worker 11's thread budget | srv | **Opus** | High | ON | 20, 21, 28 | ready |

---

## Phase 5 — HA + advanced features (parallel)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 2e | `trace-moe-anime-split` | srv+web | Sonnet | High | ON | 24, 38 (benefits from per-file pipelining) | planned |
| 2f | `ffmpeg-gpu-reencode-endpoint` — Opus confirmed (AI struggles without a browser to test) | srv | **Opus** | High | ON | 28 | planned |
| 30 | `gpu-aspect-ratio-multi-gpu` | srv | Sonnet | Medium | ON | 01 | planned |
| 31 | `duplicate-manga-detection` | srv | Sonnet | Medium | ON | 1d | planned |
| 32 | `command-search-tags` | web | Haiku | Low | OFF | 22 | planned |

---

## Phase 6 — Final consolidation (⇒ merges to master)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 33 | `final-merge-and-cleanup` — user performs manual smoke testing in addition to standard gates | shared | Sonnet | Medium | ON | All Phase 5 done | planned |

---

## Open Questions — resolved

All originally-flagged questions now have decided answers. Captured here for traceability:

| Worker | Decision |
|:--:|---|
| 11 | **Per-job setting, not server-persisted.** Env var stays as the system ceiling; user picks per-sequence value via UI (clamped). Stored in YAML template + URL query string. Server exposes `GET /system/threads` for the UI to display the ceiling. Worker 11 prompt updated. |
| 22 | **Keep existing code; rename only.** `nameSpecialFeatures` → `nameSpecialFeaturesDvdCompareTmdb`. Add two NEW sibling commands (workers 23 and 34) + shared DVD Compare ID variable concept (worker 35). The original command stays so the user can compare behavior before deprecating it. |
| 24 | **`sourcePath` internal, "Source Path" user-facing.** No further naming question. |
| 27 | **State name: `paused`** (clean lifecycle: pending → running → paused → complete/failed). Separate `reason` field for human-readable cause (e.g. `reason: user_input`). |
| 2f | **Opus confirmed** for FFmpeg GPU re-encode — AI struggles without a browser to verify and the failure mode is "looks right, doesn't work." |
| 33 | **Manual smoke testing required** in addition to standard gates. User performs the manual pass; this worker doesn't automate beyond gates. |

## Test coverage discipline (applies to every worker)

Per [feedback_test_coverage_required.md](C:\Users\satur\.claude\projects\d--Projects-Personal-media-tools\memory\feedback_test_coverage_required.md):

- **Adding functionality:** write tests covering the new behavior.
- **Updating functionality:** add or update tests to reflect the change.
- **e2e tests:** valuable for full sequence runs, modal flows, undo/redo, drag-and-drop; less so for pure-presentation changes.

This is on top of TDD-failing-test-first (already in AGENTS.md). Goal: catch bugs before the user encounters them in manual use.
