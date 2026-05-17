# Worker Manifest — Mux-Magic Huge Revamp

This is the live tracking document for all workers in the Mux-Magic huge revamp. The full plan lives at [PLAN.md](PLAN.md).

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
| 39 | [shared-to-tools-rename](39_shared-to-tools-rename.md) | tools | Sonnet | High | ON | — | done |
| 01 | [mux-magic-rename](01_mux-magic-rename.md) | tools | Sonnet | High | ON | 39 | done |
| 02 | [npm-publish-key-setup](02_npm-publish-key-setup.md) | tools | Haiku | Low | OFF | — | done |
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
| 37 | [edit-variables-modal-and-sidebar](37_edit-variables-modal-and-sidebar.md) | web | Sonnet | Medium | ON | 36 | done |

### Web track (16 workers)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 08 | [language-fields-and-tagify](08_language-fields-and-tagify.md) | web | Sonnet | Medium | ON | 01 | done |
| 09 | [number-fields-redesign](09_number-fields-redesign.md) | web | Sonnet | Medium | ON | 01 | done |
| 0a | [json-field-readonly](0a_json-field-readonly.md) | web | Haiku | Low | OFF | 01 | done |
| 0b | [auto-paste-yaml](0b_auto-paste-yaml.md) | web | Haiku | Low | OFF | 01 | done |
| 0c | [scale-resolution-aspect-lock](0c_scale-resolution-aspect-lock.md) | web | Sonnet | Medium | ON | 01 | done |
| 0d | [narrow-view-menu-animate](0d_narrow-view-menu-animate.md) | web | Sonnet | Medium | ON | 01 | done |
| 0e | [story-actions-and-reopen](0e_story-actions-and-reopen.md) | web | Haiku | Low | OFF | 01 | done |
| 0f | [undo-redo-scroll-to-affected](0f_undo-redo-scroll-to-affected.md) | web | Sonnet | Medium | ON | 01 | done |
| 10 | [apirunmodal-rename](10_apirunmodal-rename.md) — shipped as part of worker 17 (PR #95) | web | Haiku | Low | OFF | 01 | done |
| 11 | [limit-execution-threads-ui](11_limit-execution-threads-ui.md) — per-job thread cap as a `threadCount` Variable; adds `DEFAULT_THREAD_COUNT` env var; per-job quota enforcement in `taskScheduler.ts` | web+srv | Sonnet | High | ON | 01, 36 (Variables foundation) | done |
| 12 | [sequence-jobs-formatting](12_sequence-jobs-formatting.md) | web | Haiku | Low | OFF | 01 | done |
| 13 | [merge-subtitles-offsets-label](13_merge-subtitles-offsets-label.md) | web | Haiku | Low | OFF | 01 | done |
| 14 | [dryrun-to-query-string](14_dryrun-to-query-string.md) | web | Sonnet | Medium | ON | 01 | done |
| 15 | [dry-run-silent-failures](15_dry-run-silent-failures.md) | web | Sonnet | Medium | ON | 01 | done |
| 16 | [user-event-migration](16_user-event-migration.md) | web | Sonnet | High | ON | 01 | done |
| 17 | [run-in-background-sequence-modal](17_run-in-background-sequence-modal.md) | web | Sonnet | High | ON | 10 | done |
| 3d | [loadmodal-backdrop-leak-fix](3d_loadmodal-backdrop-leak-fix.md) — bug-fix follow-up to worker 0b: open LoadModal synchronously so the paste listener attaches before `navigator.clipboard.readText()` resolves; gates Modal visibility on a new `loadModalAutoPastingAtom` to avoid flash | web | Sonnet | Medium | ON | 0b | done |
| 28 | [threadcount-variable-registry-unification](28_threadcount-variable-registry-unification.md) — cleanup follow-up to worker 11: registers `threadCount` in the unified Variables registry from worker 36 (was a parallel side-channel); makes TypePicker registry-driven. Originally slotted for the Phase 4 structured-logging worker; that worker relocated to id `41` per the "never renumber" rule. | web | Sonnet | Medium | ON | 11, 36, 37 | done |
| 43 | [builder-seqjson-param](43_builder-seqjson-param.md) — Builder URL shrink: live writer + `buildBuilderUrl` switch to minified-JSON + base64url under new `?seqJson=` param. Legacy `?seq=` still decodes via fallback. No compression in prod (deferred); committed `vitest bench` measures YAML vs JSON raw + gzipped to inform a future compression worker. | web | Sonnet | Medium | ON | 01 | done |
| 44 | [step-id-randoms-and-blank-persist](44_step-id-randoms-and-blank-persist.md) — replaces counter-based step IDs with random `step_<4 base36>` ids minted at every insertion site (drops `stepCounterAtom` entirely); persists blank-placeholder steps in YAML so undo/redo, copy-yaml, and `?seq=` round-trips don't drop them; server runner schema accepts `command: ""` and `flattenItems` skips blanks as no-ops. Eliminates duplicate React-key + duplicate view-transition-name warnings and the undeletable-blank-card bug. Supersedes `b4a88123`'s counter-walking fix. | web+srv | Opus | High | ON | 01 | done |
| 46 | [scale-resolution-aspect-link-fix](46_scale-resolution-aspect-link-fix.md) — bug-fix follow-up to worker 0c: replaces the two per-side `AspectLockButton` instances (one on each x/y group) with a single cross-group link rendered between the `from` and `to` field clusters; locked state constrains `(x2, y2)` to preserve the `(x1, y1)` aspect ratio rather than locking each side to itself | web | Sonnet | Medium | ON | 0c | done |

### Other track (3 workers)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 18 | [loadenvfile-migration](18_loadenvfile-migration.md) | infra | Haiku | Low | OFF | 01 | done |
| 19 | [yaml-codec-merge](19_yaml-codec-merge.md) | web | Sonnet | Medium | ON | 01 | done |
| 1a | [reorder-tracks-skip-on-misalignment](1a_reorder-tracks-skip-on-misalignment.md) | srv+web | Sonnet | Medium | ON | 01 | done |

### Cross-repo track (5 workers)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 1b | [media-sync-rename-to-gallery-downloader](1b_media-sync-rename-to-gallery-downloader.md) | cross | Sonnet | High | ON | 01 | done |
| 1c | [gallery-downloader-decouple-and-ha-endpoint](1c_gallery-downloader-decouple-and-ha-endpoint.md) | cross | Sonnet | High | ON | 1b | done |
| 1d | [gallery-downloader-consume-mux-magic-tools](1d_gallery-downloader-consume-mux-magic-tools.md) | cross | Sonnet | Medium | ON | 1c, 02, 39 + a published `@mux-magic/tools` release | done |
| 1e | [mux-magic-webhook-reporter](1e_mux-magic-webhook-reporter.md) | srv | Sonnet | Medium | ON | 01 | done |
| 1f | [mux-magic-anime-manga-commands](1f_mux-magic-anime-manga-commands.md) | srv+web | Sonnet | High | ON | 01 | done |

---

## Phase 2 — CLI extraction (serial)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 20 | [cli-package-extract](20_cli-package-extract.md) | cli | **Opus** | High | ON | All Phase 1 done | done |
| 21 | [observables-shared-split](21_observables-shared-split.md) — promotes `taskScheduler` + reusable rxjs operators from server into `@mux-magic/tools` | cli+srv | Sonnet | High | ON | 20 | done |
| 32 | [lookup-types-from-server](32_lookup-types-from-server.md) — migrates [LookupModal/types.ts](../../packages/web/src/components/LookupModal/types.ts) to import canonical `LookupSearchResult`/`LookupType`/`LookupRelease` from `@mux-magic/server`; eliminates the `eslint-disable no-restricted-syntax` bypass installed by worker 06. `LookupVariant`/`LookupGroup` stay web-only (UI synthesis); `LookupState`/`LookupStage` stay web-only (state machine). | srv+web | Sonnet | Medium | ON | 01, 06 | done |

---

## Phase 3 — Name Special Features overhaul

The existing `nameSpecialFeatures` code is preserved (renamed only by worker 22, then split into modules by worker 3a). Two new sibling commands are added for narrower workflows, plus a shared "DVD Compare ID variable" concept that lets steps reference each other's lookup IDs (similar to path variables). Workers 25, 26, 27 then improve specific subsystems of the renamed command.

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 22 | [nsf-rename-to-dvdcompare-tmdb](22_nsf-rename-to-dvdcompare-tmdb.md) — rename existing `nameSpecialFeatures` → `nameSpecialFeaturesDvdCompareTmdb`; **code unchanged** | srv+web | Sonnet | Medium | ON | 21 | done |
| 3a | [nsf-pipeline-split-into-modules](3a_nsf-pipeline-split-into-modules.md) — behavior-preserving split of the 1,325-line NSF pipeline into focused modules. Unblocks parallel improvements in 25/26/27 | srv | **Opus** | High | ON | 22 | done |
| 23 | [nameMovieCutsDvdCompareTmdb-new-command](23_namemoviecuts-dvdcompare-tmdb-new-command.md) — new command: rename movies + move into directories by edition. Uses TMDB + DVD Compare | srv+web+cli | Sonnet | High | ON | 22, 35, 3a | done |
| 24 | [source-path-abstraction](24_source-path-abstraction.md) — unified `SourcePath` control (field name `sourcePath` internal, "Source Path" user-facing) | srv+web+cli | **Opus** | High | ON | All Phase 1 done | done |
| 25 | [nsf-fix-unnamed-overhaul](25_nsf-fix-unnamed-overhaul.md) — duration-aware ranking, order-based tie-break, per-release answer cache (builds on the restored Smart Match modal from worker 58) | srv+web | Sonnet | High | ON | 22, 3a, 58 | ready |
| 26 | [nsf-edition-organizer](26_nsf-edition-organizer.md) — sibling-file co-movement, destination collision detection, `editionPlan` preview event | srv+web | Sonnet | High | ON | 25 (implicit 3a) | ready |
| 27 | [nsf-cache-state-persistence](27_nsf-cache-state-persistence.md) — adds `paused` job state with separate `reason` field; persists jobs to disk | srv+web | Sonnet | High | ON | 25 (implicit 3a) | ready |
| 34 | [onlyNameSpecialFeaturesDvdCompare-new-command](34_onlyNameSpecialFeaturesDvdCompare-new-command.md) — new command: non-movie variant (no TMDB needed) | srv+web+cli | Sonnet | High | ON | 22, 35, 3a | ready |
| 35 | [dvd-compare-id-variable](35_dvd-compare-id-variable.md) — registers `dvdCompareId` as a Variable type in the new system (multi-instance, named); generic pattern for future TMDB/AniDB ID types | web | Sonnet | Medium | ON | 22, 36 (Variables foundation) | done |
| 45 | [id-variable-types-and-field-link-awareness](45_id-variable-types-and-field-link-awareness.md) — register `tmdbId`/`anidbId`/`malId` Variable types (batch); generalize worker 35's auto-create scan to any field whose name matches a registered linkable type; make `NumberWithLookupField` link-aware so typing in the step field writes through to the linked Variable transparently | web | Sonnet | Medium-High | ON | 35, 36, 37 | ready |
| 49 | [nsf-dvdcompare-id-direct-release-hash](49_nsf-dvdcompare-id-direct-release-hash.md) — shortcut in NSF flow: when a `dvdCompareId` is already set on the command, skip the movie-select/TMDB-lookup stage entirely and jump straight to the release-hash chooser for that ID; extend `searchDvdCompare` with a `getReleaseHashesByDvdCompareId(id)` helper if one doesn't already exist; cleanly composes with worker 45's link-aware `NumberWithLookupField` | srv+web+cli | Sonnet | Medium | ON | 22, 35, 3a, 45 | planned |

---

## Phase 4 — Server infrastructure

> Note: the structured-logging worker (originally numbered `28`) is now `41` — slot `28` was reassigned to a Phase 1B follow-up before the Phase 4 prompts were written. Plan rule: never renumber existing workers.

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 41 | [structured-logging](41_structured-logging.md) — structured logger in `@mux-magic/tools` bridged to `appendJobLog`; AsyncLocalStorage trace correlation via synthetic-uuid `startSpan`; mode-aware `logInfo/logError` (api mode emits structured); ships `/logs/structured` SSE feed. No new runtime deps. | srv+cli | Sonnet | Medium | ON | 21 | done |
| 2a | [server-template-storage](2a_server-template-storage.md) — file-backed `/api/templates` CRUD + web sidebar; templates become the canonical reusable form, URL query stays as the share-this-instance mechanism | srv+web | Sonnet | High | ON | 01 | done |
| 2b | [error-persistence-webhook](2b_error-persistence-webhook.md) — on-disk job-error store + delivery state machine with backoff; boot-time replay of pending webhook deliveries; `/api/errors` routes | srv | Sonnet | Medium | ON | 41 | done |
| 2c | [pure-functions-sweep](2c_pure-functions-sweep.md) — extract pure cores from `packages/server/src/tools/**`; thin wrappers retain exported signatures; refactor-only, no behavior changes; excludes `nameSpecialFeatures*` (Phase 3) and `app-commands/**` (worker 38) | srv+web | Sonnet | High | ON | 20 | done |
| 38 | [per-file-pipelining](38_per-file-pipelining.md) — rewrite every command handler to a single operator contract `(params, upstream$: Observable<FileContext>) => Observable<FileContext>`; sequence runner becomes one `reduce → mergeMap` chain; folder-level callers reach the new contract through a generic `wrapAsSourcePath` adapter. Each step has an optional `sourcePath` (first step requires one) — when set, fresh `getFilesAtDepth` stream; when omitted, inherit upstream. No `forEachFiles` group, no flag, no fork: users never have to think about pipelining boundaries. Full-set commands (`nameTvShowEpisodes`, `nameAnimeEpisodes*` for order-dependence; `nameSpecialFeaturesDvdCompareTmdb`, `nameMovieCutsDvdCompareTmdb` for duplicate disambiguation; likely others) `toArray()` internally — same operator signature, halt cross-step concurrency by design. Wide blast radius: every command, every test, every direct-command HTTP route. Design history + chosen vs rejected shapes in [38-sketches/](38-sketches/). Multiplies value of worker 11's thread budget across every sequence. | srv+web | **Opus** | High | ON | 20, 21, 41 | ready |
| 3b | [extract-subtitles-multi-language-type-filter](3b_extract-subtitles-multi-language-type-filter.md) — multi-language `subtitlesLanguages` array, tri-state `typesMode` (`none\|include\|exclude`) + `subtitleTypes` chip picker, single batched `mkvextract` call per file. Removes hardcoded image-codec auto-skip. | srv+web+cli | Sonnet | Medium | ON | 20 | planned |
| 3c | [bcp47-language-variants](3c_bcp47-language-variants.md) — BCP 47 locale variants (`zh-Hans-CN`, `zh-Hant-HK`, `pt-BR`, …) via optional `ietf` field on `LanguageSelection`. Augments 3-letter codes, emits `language-ietf` to mkvpropedit/mkvmerge alongside legacy `language`. Secondary "Region/Variant" picker appears only for curated base languages. | srv+web+cli | Sonnet | Medium | ON | 08, 20 | planned |
| 3e | [gallery-downloader-task-pools](3e_gallery-downloader-task-pools.md) — adds named per-task-type concurrency pools to `@mux-magic/tools` taskScheduler (third admission dimension alongside global cap + per-job claim); adopts in Gallery-Downloader so image downloads, Webtoons lookups, DLsite scrapes, etc. each get their own rate-limit-derived cap. Two PRs — mux-magic API extension publishes first, then gallery-downloader bumps and adopts. | tools+cross | Sonnet | High | ON | 21, 1d + a published `@mux-magic/tools` minor bump after 21 | ready |
| 40 | [file-organization-commands](40_file-organization-commands.md) — ports three PowerShell housekeeping scripts to native commands: `moveFilesIntoNamedFolders` (each file → same-named subfolder), `distributeFolderToSiblings` (copy a folder — defaults to `./attachments` — into every sibling dir, optional source-delete), `flattenChildFolders` (move all files from every immediate child dir up to parent, optional empty-dir cleanup). Uses `fs.rename` for the same-volume moves and `aclSafeCopyFile` for the cross-volume distribute. | srv+web+cli | Sonnet | Medium | ON | 20 | ready |
| 47 | [errors-panel-and-e2e](47_errors-panel-and-e2e.md) — follow-up to worker 2b: builds the web Errors panel (list + detail + state badges + retry/dismiss actions) on top of 2b's `/api/errors` routes, plus the deferred e2e covering the persist → pending → delivered flow and the exhausted → manual-redeliver flow. UI defers to existing job-card styles; new components ship with the mandated stories + mdx triple. Originally landed as id `45` in PR #114; renumbered to `47` to free id `45` for the previously-allocated Phase-3 worker `id-variable-types-and-field-link-awareness`. | web+srv | Sonnet | Medium | ON | 2b | planned |
| 53 | [version-iscontainerized-fix](53_version-iscontainerized-fix.md) — `/version` returns `isContainerized: true` for local runs because `existsSync("/.dockerenv")` matches even when the host has a leftover `/.dockerenv` file. Replace with a positive container signal: trust an explicit build-time env var (`MUX_MAGIC_CONTAINER=1` set only in the Dockerfile) and fall back to a `/proc/1/cgroup` substring check for `docker`/`containerd`/`kubepods` on Linux. (Renumbered from 47 to resolve a duplicate-ID collision with `47_errors-panel-and-e2e`; `47_errors-panel-and-e2e` keeps its slot per the "never renumber filed workers" rule.) | srv | Haiku | Low | OFF | — | planned |
| 54 | [bare-console-log-to-structured-loginfo](54_bare-console-log-to-structured-loginfo.md) — sweep ~69 bare `console.log`/`warn`/`error` calls across ~31 files in `packages/server/src/**`, `packages/tools/src/**`, and `packages/cli/src/**` over to worker 41's structured `logInfo`/`logWarning`/`logError`. Surfaced by worker 23's code review. Refactor-only, no behavior change. Excludes runtime web UI (`packages/web/src/**` — no structured-log bridge yet), build / maintenance scripts (run at build time, output to developer terminal), the startup banner (runs pre-logger), `logMessage.ts` itself, the `console.time`/`console.timeEnd` pair in `cli.ts` (no logger equivalent), and tests that deliberately spy on `console.*`. | srv+cli | Sonnet | Medium | ON | 41 | done |
| 56 | [test-not-it-sweep-and-guard](56_test-not-it-sweep-and-guard.md) — sweep ~5,014 legacy `it(` calls across ~709 `*.test.{ts,tsx}` files to `test(` via auto-fix from a new `vitest/consistent-test-it` ESLint rule (scoped to test files only). Cross-links the rule from [docs/agents/testing.md:22](../agents/testing.md#L22). e2e Playwright specs unaffected (different `test` namespace, excluded by the file glob). Should land before Phase 5 test-heavy workers spread the regression further. | infra | Haiku | Low | OFF | — | planned |
| 55 | [windows-drive-relative-path-guard](55_windows-drive-relative-path-guard.md) — closes a Windows-only foot-gun where POSIX-style paths from the client (`/work`, `/home`, `/seq-root`) pass `isAbsolute` but are drive-relative at the syscall layer, so `fs.mkdirSync("/work")` silently creates `D:\work` on the dev host. Adds `assertNotDriveRelative` (platform-gated to `win32`) to [pathSafety.ts](../../packages/server/src/tools/pathSafety.ts), wires it into `validateReadablePath` so all file-explorer + command endpoints inherit it, and emits a useful error naming the input path AND the inferred CWD drive so the operator can paste a fix. Linux/macOS deploys unaffected (platform gate). Tests pure-unit with injected `process.platform` so CI on any OS exercises the rejection. | srv | Sonnet | Medium | ON | — | done |
| 57 | [auto-mock-cli-spawn-operations](57_auto-mock-cli-spawn-operations.md) — lift the per-test `vi.mock("../cli-spawn-operations/*.js")` boilerplate into `packages/server/vitest.setup.ts`, paralleling the existing memfs auto-mock for `node:fs`. Every spawn-op wraps a 3rd-party `mkvtoolnix`/`ffmpeg` binary, so the test-environment rationale is identical: not installed in CI, touches real disk, output non-deterministic from `vol.fromJSON`. Auto-mocking at the setup layer means forgetting to stub a spawn-op fails loudly (`vi.fn()` returns `undefined`) instead of silently shelling out, and removes the per-test boilerplate (~5 existing tests + new ones from workers 4d/4e/4f/4b). Surfaced by worker 4d's code review. | infra | Sonnet | Medium | ON | — | planned |
| 60 | [v1-feature-parity-audit](60_v1-feature-parity-audit.md) — **research/audit worker (docs only)**. Diffs `server-v1.0.0` (commit `ff92625b`, the last commit with the legacy `packages/web/public/builder/` tree intact) against current `feat/mux-magic-revamp` to find every user-visible v1.0.0 feature missing or regressed from the React conversion. Surfaced by worker 58's discovery of three lost-but-not-noticed NSF regressions (PromptModal Play, Smart Match modal, fake-mode prompts); user's instinct is *"there were probably more I never tested"*. Produces a report at `docs/audits/v1.0.0-feature-parity.md` + one follow-up worker doc per confirmed regression, slotted into the manifest as `ready`/`planned`. No code restoration in this PR — each restoration gets its own focused follow-up. | infra | Sonnet | Medium | ON | — | ready |
| 58 | [nsf-restore-interactive-flow](58_promptmodal-cancel-and-play-fix.md) — **asap user-blocking restoration sweep** (filename keeps the original slug per "never renumber filed workers"; scope expanded mid-triage). Three parts ship together: **(A)** Fix PromptModal's broken `▶ Play` (lift the video sub-modal into a standalone atom-driven `VideoPreviewModal`; drop `window.openVideoModal`) and add explicit `Cancel job` (red, `DELETE /jobs/:id`) + `Close (job stays running)` buttons + paused-pipeline header + non-destructive Escape + `Ctrl+C` destructive shortcut. **(B)** Port the batch "Smart Match" / "Fix Unnamed" modal that v1.0.0 shipped at `packages/web/public/builder/js/components/specials-mapping-modal.js` (added 2026-05-08 in `a7fef431`, deleted 2026-05-10 in `28534ec5`, never ported) — port the recovered `specials-fuzzy.js` scorer (`DURATION_WEIGHT=0.7`, `LOW_CONFIDENCE_THRESHOLD=0.6`) and the per-row table modal as a Jotai-atom singleton; add `durationSeconds` to `UnnamedFileCandidate`. **(C)** Rewire the NSF fake-data scenario to emit `type: "prompt"` for the Phase-2 collision and surface the post-run Smart Match trigger — today the scenario explicitly *"auto-skip[s] after a short pause so the sequence doesn't block waiting for user input"*, which means dry-run testing of the interactive flow is impossible. | srv+web | Sonnet | High | ON | — | in-progress |
| 61 | [strip-redundant-return-types](61_strip-redundant-return-types.md) — sweep arrow-function return-type annotations across `packages/**/src/` where TS would infer the same type. User preference: avoid manually typing return values unless required, because an explicit annotation can silently mis-describe the contract if the body later changes (the catch case that triggered this: a `: string \| null` annotation outliving a body that was simplified to always return `string`, forcing call sites to handle an impossible `null`). Per-package commits in order (`tools` → `cli` → `server` → `web`); round-trip through `yarn typecheck` to detect cases where the annotation is load-bearing (mutual recursion → TS7023, generics that collapse to `unknown`, exported `@mux-magic/tools` API surface) and restore those with a one-line comment explaining why. Closes with a new rule + self-check table row in [docs/agents/code-rules.md](../agents/code-rules.md). No behavior change — pure syntactic sweep. | tools+cli+srv+web | Sonnet | Medium | ON | — | ready |

---

## Phase 5 — HA + advanced features (parallel)

| ID | Slug | Track | Model | Effort | Thinking | Depends | Status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 2e | `trace-moe-anime-split` | srv+web | Sonnet | High | ON | 24, 38 (benefits from per-file pipelining) | planned |
| 2f | `ffmpeg-gpu-reencode-endpoint` — Opus confirmed (AI struggles without a browser to test) | srv | **Opus** | High | ON | 28 | planned |
| 30 | `gpu-aspect-ratio-multi-gpu` | srv | Sonnet | Medium | ON | 01 | planned |
| 31 | `duplicate-manga-detection` | srv | Sonnet | Medium | ON | 1d | planned |
| 3f | `command-search-tags` | web | Haiku | Low | OFF | 22 | planned |
| 42 | [foreach-folder-bulk](42_foreach-folder-bulk.md) — new `forEachFolder` group kind iterates child steps over each subfolder of a parent dir; central `<parentPath>/.mux-magic.yaml` registry supplies per-folder `dvdCompareId` so NSF runs without prompting; pre-flight consistency check halts on registry/disk drift; sub-jobs `paused` (worker 27) or `skipped` with `needs-attention` on interactive input; review queue page resolves them. Also collapses `InsertDivider` to a three-control layout (Step, Group ▾ dropdown, Paste). | srv+web | Sonnet | High | ON | 27, 35, 36, 25 (soft) | ready |
| 43 | [log-sequence-caller-info](43_log-sequence-caller-info.md) — capture caller identity (IP, reverse-DNS hostname, `Origin`, `Referer`, `User-Agent`) at `/sequences/run` dispatch; persist as a structured `callerInfo` field on the umbrella sequence Job and emit as the first log line. Helper `getCallerInfo(context)` + bounded async `resolveCallerHostname`. Renders a "Dispatched by" row in `JobCard` with a full-details disclosure. | srv+web | Sonnet | Medium | ON | 01, 41 (soft) | ready |
| 48 | [file-explorer-modal-search-and-filters](48_file-explorer-modal-search-and-filters.md) — adds a search/filter input to `FileExplorerModal`, a video-only toggle button (reuses existing `isVideoFile()` detector), and investigates the clipboard-icon "does nothing" report — most likely a missing visual confirmation rather than a true no-op since the handler at `FileExplorerModal.tsx:722` does call `navigator.clipboard.writeText` via `copyPath` | web | Sonnet | Medium | ON | 01 | planned |
| 4a | [duplicate-music-files-scheduler-audit](4a_duplicate-music-files-scheduler-audit.md) — audits the existing `hasDuplicateMusicFiles` command against the new per-job thread budget (worker 11) and per-file pipelining (worker 38). Today the command uses RxJS `groupBy` over a directory walk that assumes batch-mode; verify duplicate detection still completes correctly under a constrained per-job claim, and decide whether to keep terminal `.pipe(toArray())` (batch-mode allowed) or rewrite to streaming dedup | srv | Sonnet | Medium | ON | 11, 38 | planned |
| 4b | [audio-library-fingerprint-dedup](4b_audio-library-fingerprint-dedup.md) — new command for cross-library audio dedup via Chromaprint `fpcalc` fingerprinting, addressing the "metadata-tagged CD-rip vs unnamed `mw_battle1.mp3`" case that filename-only dedup can't catch. Adds new `audioFingerprint` tool + `runFpcalc` cli-spawn-op (pattern mirrors `runFfmpeg`/`runMkvPropEdit`); documents `fpcalc` as a new external-tool prerequisite alongside `mkvmerge`/`ffmpeg`. Two-pass: build fingerprint index of reference dir, then `mergeMap` candidates through (respects new scheduler) | srv | Opus | High | ON | 11 | planned |
| 4c | [subtitle-attachments-and-track-granular-merge](4c_subtitle-attachments-and-track-granular-merge.md) — two coupled fixes: (a) add optional `extractAttachments` flag to `extractSubtitles` so the user has attachment files locally when editing; (b) add `mode: "replace-all" \| "replace-by-track-uid"` discriminator to `mergeTracks`/`mergeSubtitlesMkvMerge` so the user can extract one subtitle track, edit it, and merge it back replacing only that one track without clobbering other subs/attachments; reuses the `replaceAttachmentsMkvMerge` selective-replacement pattern | srv+web | Opus | High | ON | 3b | planned |
| 4d | [chapter-renumber-command](4d_chapter-renumber-command.md) — new command: renumber MKV chapters sequentially via `mkvmerge --chapters chapters.xml -o output input` round-trip (lossless metadata-only remux, no re-encode). Handles split-source files where episode 2 has chapters numbered 8/9/10 instead of 1/2/3, and multi-disc joins where chapters repeat 1..30 instead of running 1..N. New spawn op `writeChaptersMkvMerge` (mkvpropedit's chapter-name model is too narrow for full renumber) | srv | Sonnet | Medium | ON | 01 | done |
| 4e | [detect-trailing-credit-chapters](4e_detect-trailing-credit-chapters.md) — new dry-run-first command (mirrors `hasDuplicateMusicFiles` shape): scan series files for trailing chapters whose names match `Credits`/`End Credits`/`ED`/`Ending`/`Outro`/`Preview` (configurable patterns); emit a list of files + flagged chapter ranges for downstream removal. Output composes with worker 4d (renumber) once a separate trim-range command lands | srv | Sonnet | Medium | ON | 01 | planned |
| 4f | [signs-songs-forced-flag](4f_signs-songs-forced-flag.md) — new command: scan subtitle tracks for names matching "Signs & Songs"/"Signs/Songs"/"S&S"/etc. (configurable, case-insensitive, sensible defaults) and set `flag-forced=1` via `mkvpropedit --edit track:N`; mirrors the `fixIncorrectDefaultTracks` pattern; reuses `getMkvInfo` + `runMkvPropEdit` | srv | Sonnet | Medium | ON | 01 | planned |
| 50 | [wav-to-flac-convert](50_wav-to-flac-convert.md) — new command: walk a music directory for `.wav` files and convert each to FLAC via `ffmpeg -c:a flac` (preserve metadata where possible). Direct-clone-and-reverse of the existing `replaceFlacWithPcmAudio` + `convertFlacToPcmAudio` pattern; new `convertWavToFlac.ts` app-command + matching cli-spawn-op | srv | Haiku | Low | OFF | 01 | planned |
| 51 | [release-date-into-date-tag](51_release-date-into-date-tag.md) — new command: when an MKV file has a "Release Date" tag but no "Date" tag, copy the value across via `mkvpropedit --edit info` (or via a `mkvextract tags` round-trip if the existing `runMkvPropEdit` wrapper doesn't already support tag editing). Bring legacy releases into a consistent tag schema for downstream media managers | srv | Sonnet | Medium | ON | 01 | planned |
| 52 | [dvdcompare-cuts-censorship-detection](52_dvdcompare-cuts-censorship-detection.md) — extend the existing DVDCompare integration with a "cuts" parser: scrape the cuts table for a known release (mirror the `parseSpecialFeatures` HTML-parse pattern), then compare the local file's duration against the expected runtime ± listed cuts to flag potential censorship/edition mismatches. New `parseDvdCompareCuts` tool + `detectPotentialCensorship` app-command. Needs HTML fixtures for integration tests since web scrapers are brittle | srv | Sonnet | High | ON | 22, 3a | planned |
| 62 | [scale-resolution-scales-style-fields](62_scale-resolution-scales-style-fields.md) — make the `scaleResolution` rule actually scale per-style `Fontsize`/`Outline`/`Shadow`/`MarginV` (height ratio) and `MarginL`/`MarginR`/`Spacing` (width ratio) by the same `to/from` ratio it applies to `PlayResX`/`PlayResY`, matching what [docs/dsl/subtitle-rules.md](../dsl/subtitle-rules.md) already claims. Today [applyAssRules.ts](../../packages/server/src/tools/applyAssRules.ts) only rewrites `[Script Info]`; styles stay at their pre-scale values, so a 1080→360 downscale leaves `MarginV=90` rendering as 25% of the canvas instead of 8.3%. Adds `ignoredStyleNamesRegexString` to `ScaleResolutionRule` for signs/songs protection. `[Events]` Dialogue-line margins + inline override tags (`\pos`, `\fs`, etc.) deferred to a future worker. | srv+web | Sonnet | Medium | ON | 01 | ready |

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

This is on top of TDD-failing-test-first (already in [AGENTS.md](../../AGENTS.md)). Goal: catch bugs before the user encounters them in manual use.

- **Adding functionality:** write tests covering the new behavior.
- **Updating functionality:** add or update tests to reflect the change.
- **e2e tests:** valuable for full sequence runs, modal flows, undo/redo, drag-and-drop; less so for pure-presentation changes.
