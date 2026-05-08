# Orchestration Checklist — 2026-05-07

> **USER BACK 2026-05-07.** Decisions captured below in "Decisions captured 2026-05-07 (post-restart)". Autonomy mode ended.
>
> Earlier note: AUTONOMY MODE (user was AFK) — orchestrator merged clearly-safe PRs and left comments on ambiguous ones; deferred W22b/W26b/W18b/W10-N2 for user. Each merge annotated below with `merged by orchestrator (autonomous)`.

## Decisions captured 2026-05-07 (post-restart)

| ID | Decision |
|----|----------|
| W22b | Auto-detect via `MediaSource.isTypeSupported()`; Opus/WebM default; drop subs; **hardcode `/media` as the only allowed path root** (not env-var); README must document that browser-safe playback requires files mounted at `/media`, otherwise it falls back to the (buggy) in-browser path. Range strategy: Option B (transcode-to-temp). Defer multi-audio-selector + Docker temp-dir env. See [docs/options/ffmpeg-audio-reencode-endpoint.md §12](options/ffmpeg-audio-reencode-endpoint.md). |
| W7b (incl. N2) | Spawn one worker for **all three** Phase B pieces in a single PR: interactive renaming (`POST /files/rename`), searchable suggestions (extend summary record with `allKnownNames`), duplicate-detection prompt enhancement (`autoNameDuplicates` flag) — and **fold W10-N2 same-named-files modal with playback into this worker** (it's the same multi-select prompt with ▶ Play). See [docs/file-explorer-phase-b.md](file-explorer-phase-b.md). |
| W10-N2 | **Folded into W7b** above. No separate worker. |
| W8b | Extend `possibleNames` to `{ name: string, timecode?: string }[]`. Implement Option C smart-suggestion-first UX. See [docs/options/specials-checkbox-list.md](options/specials-checkbox-list.md). |
| W24b | **Media-sync only — skip media-tools.** **Transport: webhook (Option C).** Two URLs (POST + JSON body): `WEBHOOK_ERRORS_PRESENT_URL` (fired on sync failure) + `WEBHOOK_ERRORS_CLEARED_URL` (fired when single-error dismissal causes pending-error count to drop to 0 — there's no bulk-dismiss UI, so we hook into existing `dismissError`). **Truly silent** when env vars unset — no startup log, no warnings, fully invisible. Worker output includes HA setup walkthrough. See [docs/options/home-assistant-integration.md §8](options/home-assistant-integration.md). |
| W26b | **Still pending** — needs user call on Road A approval (heuristics in TS + optional `when:` aggregate predicates, no `${expr}` mini-language). |
| W18b | **Still pending** — TrueNAS registry notification approach. Urgency reduced (W21 confirmed deploy is current). |

Live status board for the multi-worker effort. Orchestrator (this Claude session) updates this file. Workers do **not** modify it.

States: `briefed → running → pushed → pr-open → awaiting-decision → ready-for-merge → merged | closed`

## All PRs — media-tools (GitHub)

### Merged ✓

- **#23** W11 — fake-data approaches (design record)
- **#24** W13 — docker stale-image diagnostics (design record)
- **#25** W14 — version-display options (design record)
- **#26** W16 — DSL subtitle JS→YAML coverage (design record; `when:` predicates pending)
- **#27** W20 — sequence YAML examples docs — <https://github.com/Sawtaytoes/media-tools/pull/27>
- **#28** W12 — copy-cancel/sequence-failure tests — <https://github.com/Sawtaytoes/media-tools/pull/28>
- **#29** W1 — remove cli-server, promote jobs UI to / — <https://github.com/Sawtaytoes/media-tools/pull/29>
- **#30** W13b — install procps so tree-kill can spawn ps — <https://github.com/Sawtaytoes/media-tools/pull/30>
- **#31** W22 — FFmpeg audio-only re-encode endpoint options (design record; W22b pending decisions)
- **#32** W11b-msw Phase 1 — install MSW + handlers + fixtures
- **#33** W14b-mt — `/version` endpoint + UI footer + boot banner
- **#34** W11b-fakedata — `--fake-data` flag + `?fake=1` + 14 tests — <https://github.com/Sawtaytoes/media-tools/pull/34>
- **#36** W11b-msw Phase 2 — `?mock=1` toggle + Node setupServer (replaces auto-closed #35)
- **#37** W8 — specials checkbox-list options (design record; merged by orchestrator (autonomous); recommends Option C; open question on `possibleNames` shape posted as PR comment)

### Open — code complete, awaiting rebase or merge

- **#33** W14b-mt — `/version` endpoint + UI footer + boot banner — <https://github.com/Sawtaytoes/media-tools/pull/33>
  - Status: **rebase in flight** (worker resolving W1 path-flatten conflicts; will force-push then I merge).
- **#32** W11b-msw Phase 1 — install MSW + handlers + fixtures — <https://github.com/Sawtaytoes/media-tools/pull/32> (draft)
  - Status: **rebase in flight** alongside #35.
- **#35** W11b-msw Phase 2 — `?mock=1` toggle + Node setupServer harness — <https://github.com/Sawtaytoes/media-tools/pull/35> (draft)
  - Status: **rebase in flight**, based on #32; will rebase onto master after #32 lands.

### Open — awaiting your decision

- **#31** W22 — FFmpeg audio-only re-encode endpoint options — <https://github.com/Sawtaytoes/media-tools/pull/31> (draft)
  - Decisions: auto-detect via `MediaSource.isTypeSupported()` vs explicit "Re-encode audio" toggle; AAC default vs Opus default.
- **#26** W16 — DSL subtitle JS→YAML coverage doc — <https://github.com/Sawtaytoes/media-tools/pull/26> (draft)
  - Decision: approve **Road A** (heuristics in TS, optionally add only `when:` aggregate predicates to DSL — no `${expr}` mini-language)?

### Open — design-record docs (merge as historical record or close)

- **#23** W11 fake-data approaches options — <https://github.com/Sawtaytoes/media-tools/pull/23> (draft) — implemented in #34
- **#24** W13 docker stale-image diagnostics — <https://github.com/Sawtaytoes/media-tools/pull/24> (draft) — led to #30
- **#25** W14 version-display options — <https://github.com/Sawtaytoes/media-tools/pull/25> (draft) — implemented in #33

## All PRs — media-sync (Gitea)

`tea`/`GITEA_TOKEN` aren't set, so you open these in the browser. PR #2 is the only one already opened on Gitea — the others are compare URLs that will create the PR for you when you click "Create pull request".

### Merged ✓
- **W14b-ms** — `/version` endpoint + UI footer + boot banner (mirrors #33)
- **W17b** — Option B implementation (grouped view for live + completed runs)

### Open
- **W17** — run-details grouping options doc — <https://gitea.octen.dev/sawtaytoes/Media-Sync/compare/master...worker/17-run-details-grouping>
- **W18** (PR #2) — TrueNAS / registry research + manifest-verification — <https://gitea.octen.dev/sawtaytoes/Media-Sync/pulls/2>

## Awaiting your decision (intentionally not merge-ready)

- **#26 W16 DSL coverage** — needs your call on Road A.
- **#31 W22 FFmpeg audio re-encode** — needs your call on auto-detect vs. toggle, AAC vs. Opus.

## Design-record docs (merge or close, your call)

- **#23 W11 fake-data options** — you chose A+D; this is the design record.
- **#24 W13 stale-image diagnostics** — led to W13b.
- **#25 W14 version-display options** — led to W14b.

## Partial — do NOT merge alone

- **#32 W11b-msw Phase 1** — install + handlers + fixtures, no toggle wiring. Wait for W11b-msw-phase2.

## Gitea (you open manually — `tea`/`GITEA_TOKEN` not set)

- W17 options: <https://gitea.octen.dev/sawtaytoes/Media-Sync/compare/master...worker/17-run-details-grouping>
- W17b impl: <https://gitea.octen.dev/sawtaytoes/Media-Sync/compare/master...worker/17b-run-details-impl>
- W18 (already open): <https://gitea.octen.dev/sawtaytoes/Media-Sync/pulls/2>
- W14b-ms: in flight.

## Wave 1 — Blocking UI

| ID | Task | Repo | Branch | Mode | State | PR |
|----|------|------|--------|------|-------|-----|
| W1 | Remove `cli-server` + node-pty; relocate jobs UI to `/` | media-tools | `worker/01-remove-cli-server` | implement | running (background) | — |
| W2a | Split `public/api/index.html` (825 lines, jobs UI) | media-tools | `worker/02a-split-jobs-html` | implement | blocked-on-W1 | — |
| W2b | Split `public/api/builder/index.html` (5277 lines, builder UI) | media-tools | `worker/02b-split-builder-html` | implement | blocked-on-W1 | — |

## Wave 2 — Non-UI / cross-repo (in flight + completed)

| ID | Task | Repo | Branch | State | PR / URL |
|----|------|------|--------|-------|----------|
| W10 | `nameSpecialFeatures` backlog | media-tools | `worker/10-name-special-features` | not-yet-spawned (deferred) | — |
| W11 | Fake-data options doc | media-tools | `worker/11-fake-data-options` | **awaiting-decision** | https://github.com/Sawtaytoes/media-tools/pull/23 |
| W12 | Copy cancel + sequence-step failure cancellation | media-tools | `worker/12-copy-cancel-and-sequence-failure` | running (background) | — |
| W13 | Docker stale-image + tree-kill ps diagnostics doc | media-tools | `worker/13-diagnostics-stale-image` | **awaiting-decision** | https://github.com/Sawtaytoes/media-tools/pull/24 |
| W14 | Version-display options doc | both | `worker/14-version-display-options` | **awaiting-decision** | https://github.com/Sawtaytoes/media-tools/pull/25 |
| W16 | Subtitle JS → DSL YAML coverage doc | media-tools | `worker/16-dsl-subtitle-coverage` | **awaiting-decision** | https://github.com/Sawtaytoes/media-tools/pull/26 |
| W17 | Media-sync run-details grouping options doc | media-sync | `worker/17-run-details-grouping` | **awaiting-decision** (Gitea, manual PR open) | https://gitea.octen.dev/sawtaytoes/Media-Sync/compare/master...worker/17-run-details-grouping |
| W18 | TrueNAS / Docker registry research (incl. manifest-verification follow-up) | media-sync | `worker/18-docker-registry-truenas` | **PR open on Gitea, awaiting-decision** (urgency reduced, registry is verified-healthy) | https://gitea.octen.dev/sawtaytoes/Media-Sync/pulls/2 |
| W20 | Sequence docs improvements w/ media-sync examples | media-tools | `worker/20-sequence-docs-examples` | running (background) | — |
| W21 | Media-tools GH Actions deploy staleness check | media-tools | (orchestrator-inline, no branch) | **complete (no PR)** | see "W21 finding" below |

## Wave 3 — Concurrent UI (spawn after W2a + W2b merge)

| ID | Task | Repo | State |
|----|------|------|-------|
| W3 | Builder: base-path reuse (C1) + sequence API for runs (C2) | media-tools | pending |
| W4 | Speed normalization kbps/Mbps/Gbps + ETA (C3) | media-tools | pending |
| W5 | Step cards drawer/sidebar experiment (C4) | media-tools | pending |
| W6 | Media player ESC after seek-bar focus fix (C5) | media-tools | pending |
| W7 | aniDB selection card (C6) + Episode Type typeahead overflow (C7) | media-tools | pending |
| W8 | Specials checkbox-list experiment options doc (C8) | media-tools | pending (pause) |
| W9 | DVD Compare direct-listing handling + tests (C9) | media-tools | pending |

## Wave 4 — In flight / pending

| ID | Task | State | PR / URL |
|----|------|-------|----------|
| W11b-msw | MSW Phase 1 (install + handlers + fixtures) | **PR open, draft** | https://github.com/Sawtaytoes/media-tools/pull/32 |
| W11b-msw-phase2 | MSW Phase 2 (`?mock=1` toggle + Node `setupServer` harness) | running (background) | — |
| W11b-fakedata | `--fake-data` server flag + `?fake=1` per-request toggle, fake `/files /inputs /queries`, +14 tests | **PR open** | https://github.com/Sawtaytoes/media-tools/pull/34 |
| W13b | Install `procps` in Dockerfile | **pushed, PR open** | https://github.com/Sawtaytoes/media-tools/pull/30 |
| W14b-mt | `/version` endpoint + UI footer + boot banner + build script (media-tools) | **PR open** | https://github.com/Sawtaytoes/media-tools/pull/33 |
| W14b-ms | Same for media-sync (mirror W14b-mt) | running (background) | — |
| W15 | Media-sync SSE restart-on-version-change | pending — depends on W14b-ms | — |
| W17b | Implement Option B (single list, collapsible groups, filter checkboxes) | **pushed, awaiting Gitea PR open** | https://gitea.octen.dev/sawtaytoes/Media-Sync/compare/master...worker/17b-run-details-impl |
| W18b | Implement chosen registry → TrueNAS notification approach | pending — urgency reduced (W21 confirmed deploy is current) | — |
| W19 | README screenshots for both apps | pending — depends on W11b | — |
| W22 | FFmpeg audio-only re-encode endpoint options doc (CUDA unnecessary — audio is CPU-bound, video copies) | **awaiting-decision** | https://github.com/Sawtaytoes/media-tools/pull/31 |

## Decision queue (surface to user when ready)

_None yet — workers running._

## W21 finding (orchestrator-inline diagnostic)

- Latest **deployed** media-tools master via GitHub Actions: commit **`57e36aa`** ("Merge PR #20", workflow `Build & Deploy`, run `25505483290`, success at 2026-05-07T15:28:55Z).
- Local `origin/master` (after `git fetch`): also `57e36aa`. Local HEAD is `e345900` (1 commit ahead, just `fix: removed unused env var from .env.example` — not yet pushed).
- **The deployed image is current.** The keepalive (`d896d21`) and tolerant EventSource ARE in production.
- **Implication:** the user's two production errors are almost certainly **the same root cause** — the `spawn ps ENOENT` crash kills the container mid-job, the SSE stream terminates abruptly, media-sync sees `TypeError: terminated` and reports "stream broke mid-read". W13b (fix tree-kill) likely fixes both symptoms.
- W18's Diun/registry-notification work is no longer urgent (TrueNAS is pulling fine); recommendation downgrade to "good hygiene, do later."
- W14 (version display) is still valuable for ongoing visibility but no longer the urgent diagnostic this round.

## Decisions surfaced to user (awaiting answer)

| ID | Question | Recommendation |
|----|----------|----------------|
| W11 | Approve `--fake-data` flag (Option A) + per-request `?fake=1` (Option D)? Cover `/files /inputs /queries` too? | A+D, broad coverage |
| W13 | How to fix tree-kill ENOENT (W13b)? | Install `procps` in Dockerfile |
| W14 | Approve `/version` JSON endpoint backed by build-time `version.json` (Option D)? | Yes, mirror `serverIdRoutes.ts` |
| W17 | Approve single-list with collapsible group headers + filter checkboxes (Option B)? | Yes |

## Notes

- media-sync remote is Gitea (`ssh://git@gitea.octen.dev:30009/sawtaytoes/Media-Sync.git`). Gitea HAS a PR API and `tea` CLI, but in this environment **`tea` is not installed and `$env:GITEA_TOKEN` is not set** — so media-sync workers push branches and return Gitea compare URLs for the user to open the PR manually. To enable auto-PR creation later: install `tea` (`winget install gitea.tea` or download from https://gitea.com/gitea/tea) and set `$env:GITEA_TOKEN` (created at https://gitea.octen.dev/user/settings/applications).
- Local Docker registry: `registry:2` at `docker-registry.octen.dev`. Build log for media-sync deploy 43 (`dea58ad7…`) confirms healthy build + push (`C:\Users\satur\Downloads\deploy-docker-deploy-43.log`).
- W13 finding (revised): `spawn ps ENOENT` is a real bug — `tree-kill`'s Linux branch shells out to `ps` and `node:24-slim` lacks `procps`. NOT just a stale-image artifact. The "SSE log stream broke" symptom IS the stale-image story (pre-`d896d21`, no keepalive). W13b will patch the tree-kill side.
- Plan reference: `C:\Users\satur\.claude\plans\claude-orchestration-hello-rippling-puppy.md`.

## Autonomous orchestrator merges (user AFK)

Order matters; events are most recent first:

| When | Action | Notes |
|------|--------|-------|
| recent | Merged **#49** W7 — Episode Type typeahead overflow + bonus TS2345 fix | (b) Typeahead positioning now uses `top` clamped to viewport (was using `bottom` which went negative when trigger was near viewport top). (a) aniDB card scope reduced — most of `docs/file-explorer-phase-b.md` needs `src/api/` server endpoints outside this worker's allow-list. **PR comment posted** noting follow-up needed (W7b). Bonus: also fixed the long-standing `nameSpecialFeatures.ts:154` TS2345 that every worker this session was carrying as "pre-existing". |
| recent | Merged **#48** W3-restart — base-path reuse + group/bulk via /sequences/run | Modified post-W2b modules (`sequence-editor.js`, `run-sequence.js`, `step-renderer.js`, `main.js`). Extracted `postSequenceYaml` shared helper. Group cards now have a green ▶ Run button that POSTs partial YAML. Individual step ▶ unchanged. yarn build clean. |
| recent | Merged **#47** W6 — media player ESC after seek-bar focus fix | One-line fix: added `{ capture: true }` to `attachModalEscapeListener` in `public/builder/js/util/modal-keys.js`. Native `<video>` controls shadow-DOM was absorbing keyboard events before bubble. All 11 existing tests pass. |
| recent | Closed **#46** W3 v1 (re-spawned as W3-restart) | Branch was based on pre-W2b state; would have re-introduced inline JS into the now-shell `public/builder/index.html`. Comment posted; W3-restart targets the post-split module structure. |
| recent | Merged **#45** W5 — step-cards drawer/sidebar experiment | Opt-in only via `localStorage.setItem("useDrawerStepCards","true")`. Default OFF — existing UX unchanged. Bottom-sheet on <640px viewports. User said upfront they may not keep this — easy to revert if so. |
| recent | Merged **#43** W2b — split `public/builder/index.html` (5288 lines) | 10 ES modules + CSS + ~335-line thin shell. Worker also fixed real bugs along the way (undo/redo binding via `setLastSnapshot()` setter; lookup-modal state references). yarn build passes. |
| recent | Merged **#44** W2a — split `public/index.html` (jobs UI) | 6 modules + 273-line CSS + ~35-line thin shell. yarn typecheck + yarn build pass. No browser smoke (sandbox). |
| recent | Merged **#42** W24 — Home Assistant integration options doc | Recommended MQTT with auto-discovery + `mqtt` npm package + Mosquitto HA add-on. **PR comment posted**: 2 open questions on Mosquitto availability + alerts-vs-dashboard scope. W24b implementation gated on those. |
| recent | Merged **#41** W23 — GH Actions Node 20 deprecation bump | `docker/login-action@v3→v4`, `docker/build-push-action@v5→v6`. `actions/checkout@master` left as user's floating ref. Single-workflow audit. |
| recent | Merged **#39** W10 N1/N3/N4 — edition folders + collision + N3 doc | Big diff, real implementation, tests added. yarn typecheck passed. **N2 modal explicitly deferred per user instruction.** |
| recent | Merged **#40** W9 DVDCompare direct-listing fix | 5 new tests; detection via `response.url` redirect to `film.php?fid=…`. |
| recent | Merged **#38** W19 README screenshots tooling | **PR comment posted**: PNGs not committed; user must run `yarn screenshots` before README image refs work. |
| recent | Merged **#37** W8 specials checkbox-list options doc | Recommended Option C (smart-suggestion-first). **PR comment posted**: open question on `possibleNames` shape needs user answer before W8b. |
| earlier | Pushed media-sync `worker/15-sse-restart` (W15) | Gitea — user opens PR manually: <https://gitea.octen.dev/sawtaytoes/Media-Sync/compare/master...worker/15-sse-restart> |

## Held UI workers (will spawn automatically once W2a + W2b both merge)

- W3 — sequence-builder base-path reuse + sequence API for runs
- W4 — kbps/Mbps/Gbps speed normalization + ETA
- W5 — step cards drawer/sidebar experiment
- W6 — media player ESC after seek-bar focus fix
- W7 — aniDB selection card + Episode Type typeahead overflow

## In-flight workers (background)

| Worker | What it's doing | Notification expected |
|--------|-----------------|-----------------------|
| W11-finisher | Writing `docs/options/fake-data.md`, draft PR | when done |
| W13-finisher | Writing `docs/diagnostics/docker-stale-image.md`, draft PR | when done |
| W14-finisher | Writing `docs/options/version-display.md`, draft PR | when done |
| W16-finisher | Writing `docs/dsl/subtitle-coverage.md`, draft PR | when done |
| W17-finisher | Committing pre-written `docs/options/run-details-grouping.md`, push, return Gitea compare URL | when done |
| W18-finisher | Committing `docs/diagnostics/docker-registry-truenas.md` (with new `registry:2` env section), push, Gitea compare URL | when done |
| W1 | Removing cli-server + node-pty; relocating jobs UI to `/`; verifying with yarn install/typecheck/build/smoke | when done |
| W12 | Copy cancel cleanup + sequence step failure cancellation; adds tests | when done |
| W20 | Adding real-world sequence YAML examples from media-sync | when done |
| W21 | Fetching media-tools GH Actions deploy log to confirm staleness | when done |
