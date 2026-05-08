# Orchestration Checklist — 2026-05-08

> Live status board for the multi-worker effort. Orchestrator (this Claude session) owns this file. Workers do **not** modify it.
>
> **GITEA_TOKEN is now configured** in `D:\Projects\Personal\media-sync\.env` (scope: repository RW, user R). Media-sync workers can now auto-open Gitea PRs via API instead of returning compare URLs.

States: `briefed → running → pushed → pr-open → awaiting-decision → ready-for-merge → merged | closed`

## What's left for the user

### Pending decisions (no PR action — your call)

| ID | Question | Notes |
|----|----------|-------|
| **W26b** | Approve **Road A** for DSL subtitle coverage? Heuristics in TS + optional `when:` aggregate predicates only — no `${expr}` mini-language. | Design record [docs/dsl/subtitle-coverage.md](dsl/subtitle-coverage.md). |
| **W18b** | Pick a registry → TrueNAS notification approach. | Urgency reduced — W21 confirmed deploy is current. Design record [docs/diagnostics/docker-registry-truenas.md](diagnostics/docker-registry-truenas.md). |

### Open PRs awaiting your review/merge

**media-tools (GitHub):**

- **[#51 W7b](https://github.com/Sawtaytoes/media-tools/pull/51)** — file-explorer Phase B: rename endpoint + searchable suggestions + duplicate-pick modal w/ playback (folds in W10-N2). 595/595 tests, AGENTS.md self-check clean.
- **[#52 W22b](https://github.com/Sawtaytoes/media-tools/pull/52)** — `/transcode/audio` endpoint with Opus/WebM auto-swap + `/files/audio-codec` probe + modal swap. 593/595 tests (2 skipped on Windows; `/media` is POSIX-only).

**media-sync (Gitea):**

- **[PR #8 W24b](https://gitea.octen.dev/sawtaytoes/Media-Sync/pulls/8)** — HA webhook reporter (two URLs, fire-on-count-zero, truly silent). 286/286 tests.
- **[PR #9 W15](https://gitea.octen.dev/sawtaytoes/Media-Sync/pulls/9)** — SSE restart-on-version-change (depends on already-merged W14b-ms).
- **[PR #10 W19](https://gitea.octen.dev/sawtaytoes/Media-Sync/pulls/10)** — README screenshots tooling. **Caveat:** PNGs not committed; run `yarn screenshots` after merging for the README image refs to resolve.

### In flight (background)

- **W25** — media-sync per-source + total duration in jobs UI (live ticker while running + final time on completion). Notification expected when PR opens.

### Held — auto-spawn on dependency

- **W8b** — specials checkbox-list smart-suggestion (Option C UX, extend `possibleNames` to `{ name, timecode? }[]`). Spawns once W7b (#51) merges — both touch `nameSpecialFeatures.ts` and W8b changes the `possibleNames` shape.

## Decisions captured this session

| ID | Decision | Status |
|----|----------|--------|
| W22b | Auto-detect via `MediaSource.isTypeSupported()`; Opus/WebM default; drop subs entirely; hardcode `/media` as the only allowed path root (not env-var). README documents volume-mount requirement. Range strategy: Option B (transcode-to-temp). See [docs/options/ffmpeg-audio-reencode-endpoint.md §12](options/ffmpeg-audio-reencode-endpoint.md). | **Shipped in PR #52.** |
| W7b (incl. N2) | Single PR for all three Phase B pieces + N2 modal fold-in (multi-select prompt with ▶ Play). See [docs/file-explorer-phase-b.md](file-explorer-phase-b.md). | **Shipped in PR #51.** |
| W10-N2 | Folded into W7b. No separate worker. | Closed via #51. |
| W8b | Extend `possibleNames` to `{ name, timecode? }[]`. Implement Option C smart-suggestion-first UX. See [docs/options/specials-checkbox-list.md](options/specials-checkbox-list.md). | **Held** until W7b merges. |
| W24b | media-sync only (skip media-tools); webhook (Option C, not MQTT — zero npm deps); two URLs `WEBHOOK_ERRORS_PRESENT_URL` + `WEBHOOK_ERRORS_CLEARED_URL`; fire `errors_cleared` from existing `dismissError` when pending count drops to 0 (no bulk-dismiss UI exists); truly silent when env vars unset; POST + JSON body. See [docs/options/home-assistant-integration.md §8](options/home-assistant-integration.md). | **Shipped in Gitea PR #8.** |
| W25 | Both per-source + total duration; live ticker while running + final time on completion. | Worker spawned, in flight. |
| AGENTS.md guardrails | Top-of-file "applies to ALL source files" rule block + pre-PR grep self-check (no `for`, no `var`, no `let` mutation, spelled-out names, brace all `if`s). Self-check applies to `.ts`, `.js`, `.mjs`, `public/**`. | **Shipped in `44cf3b5`. Validated by W7b worker** which caught `let` / abbreviation / single-letter-callback violations during its self-check. |
| Version display | Drop `v X.Y.Z` from UI footer + boot banner. package.json isn't bumped per release; git SHA + build time are the actual identity. | **Shipped in `66b3414`.** |
| Step alias display | Empty step.alias defaults to friendly `commandLabel(step.command)` (e.g. "Name Special Features") instead of internal `step.command` (`nameSpecialFeatures`). Stored YAML stays empty. | **Shipped in `200eef0`.** |
| Sequence Builder import bug | Move `schedulePathLookup` import from `sequence-editor.js` to `pickers.js` (where it's defined). Bad import introduced by W3-restart merge (#48) caused SyntaxError on builder boot. | **Shipped in `c66fc10`.** |
| W26b | Still pending — needs your call. | — |
| W18b | Still pending — needs your call. | — |

## Merged / shipped this session

### media-tools (GitHub)

- **#50 W4** — kbps/Mbps/Gbps speed + ETA (merged; you flagged the code style; AGENTS.md guardrails added in response — see below).
- **#51 W7b** *(in review)* — file-explorer Phase B + N2 fold-in.
- **#52 W22b** *(in review)* — `/transcode/audio` + `/files/audio-codec` + modal auto-swap.
- **master commits this session:**
  - `5a4227f` — W24b doc clarifications (POST, dismiss-on-zero, truly silent)
  - `b98de28` — Strike W23 historical row from CHECKLIST
  - `c66fc10` — Sequence Builder import fix
  - `66b3414` — Drop misleading `v X.Y.Z` from version displays
  - `200eef0` — Step alias defaults to friendly label
  - `44cf3b5` (earlier in session) — AGENTS.md code-rules block + self-check
  - `280342e` (earlier) — Orchestration framework + CHECKLIST scaffolding
  - `03709e0` / `8066591` (earlier) — W22b + W24b decisions docs

### media-sync (Gitea)

- **PR #8 W24b** *(in review)* — HA webhook reporter.
- **PR #9 W15** *(in review)* — SSE restart-on-version-change.
- **PR #10 W19** *(in review)* — README screenshots tooling.

## Operational notes

- **W22b worker crashed twice** with "API Error: Internal server error" at ~60 tool uses both times. Big briefs touching many files (route + helper + LRU + tests + UI swap + README) appear to exceed a budget around that point. Mitigation: split big briefs into smaller pieces, OR finish inline from the orchestrator session when the worker has substantial partial work pushed. W22b's remaining pieces were finished inline.
- **media-sync workers and shell access:** Bash/PowerShell may be initially denied in worker sandboxes. Pass `dangerouslyDisableSandbox: true` and use `git -C <abs-path>` (not `cd … && git …`) to unblock. The W24b retry confirmed this pattern.
- **Future media-sync workers** can auto-open PRs via the Gitea API now that `GITEA_TOKEN` is in `D:\Projects\Personal\media-sync\.env`. Pattern: `curl -sS -X POST -H "Authorization: token $GITEA_TOKEN" -H "Content-Type: application/json" "https://gitea.octen.dev/api/v1/repos/sawtaytoes/Media-Sync/pulls" --data-binary @<json-file>` with `head`, `base`, `title`, `body` fields. Body JSON files should be written to disk first (avoids Bash heredoc/JSON-escape pitfalls).
- **Version display fix did not bump package.json** — by design. If you ever wire CI to bump it, the `packageVersion` field is still in the `/version` JSON for backward compat.

## W21 finding (orchestrator-inline diagnostic — historical)

- Latest **deployed** media-tools master via GitHub Actions: commit `57e36aa` (run `25505483290`, success at 2026-05-07T15:28:55Z).
- The deployed image is current. Keepalive (`d896d21`) and tolerant EventSource ARE in production.
- The two production errors (`spawn ps ENOENT` + `TypeError: terminated`) were the same root cause: tree-kill ENOENT crashes the container, which terminates the SSE stream abruptly. **W13b (procps install) fixed both** — already merged.
- W18's TrueNAS-notification work is no longer urgent (registry is healthy, deploy current). Downgraded to "good hygiene, do later."

## Autonomous orchestrator merges (user AFK earlier in session — historical)

| PR | Notes |
|----|-------|
| **#49** W7 — Episode Type typeahead overflow + bonus TS2345 fix | Most of `docs/file-explorer-phase-b.md` deferred to W7b (server endpoints needed); shipped in PR #51. |
| **#48** W3-restart — base-path reuse + group/bulk via /sequences/run | Introduced the `schedulePathLookup` import bug fixed in `c66fc10`. |
| **#47** W6 — media player ESC after seek-bar focus fix | One-line `{ capture: true }` on the modal-escape listener. |
| **#46** W3 v1 — closed (re-spawned as W3-restart #48) | Branch was based on pre-W2b state. |
| **#45** W5 — step-cards drawer/sidebar experiment | Opt-in via `localStorage.useDrawerStepCards`. |
| **#43** W2b — split `public/builder/index.html` | 5288 lines → 10 ES modules + CSS + ~335-line shell. |
| **#44** W2a — split `public/index.html` | Jobs UI; 6 modules + CSS + ~35-line shell. |
| **#42** W24 — Home Assistant integration options doc | Implementation now in W24b (PR #8). |
| **#41** W23 — GH Actions Node 20 deprecation bump | Row struck from this CHECKLIST after follow-up `9e1c857` v6→v7. |
| **#39** W10 N1/N3/N4 — edition folders + collision + N3 doc | N2 was deferred → folded into W7b (#51). |
| **#40** W9 — DVDCompare direct-listing fix | 5 new tests; detection via redirect to `film.php?fid=…`. |
| **#38** W19 — README screenshots tooling (media-tools) | The media-sync side just opened as Gitea PR #10. |
| **#37** W8 — specials checkbox-list options doc | Implementation in W8b (held). |
