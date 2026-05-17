# Context for writing the remaining worker prompts

This document captures what a future worker (call it "the prompt-writer") needs to know to produce prompt files for the Phase 2-6 workers that don't yet have one (`20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 2a, 2b, 2c, 2e, 2f, 30, 31, 32, 33, 34, 35`). Worker `38` (per-file-pipelining) already has a prompt and can be used alongside `37`/`11`/`17` as additional templates.

Read this before starting. It is not a substitute for `docs/PLAN.md` or `AGENTS.md` — those still apply.

## 1. Prompt-file format (template)

The established convention (see [37_edit-variables-modal-and-sidebar.md](37_edit-variables-modal-and-sidebar.md), [11_limit-execution-threads-ui.md](11_limit-execution-threads-ui.md), [17_run-in-background-sequence-modal.md](17_run-in-background-sequence-modal.md), [38_per-file-pipelining.md](38_per-file-pipelining.md)) is:

1. `# Worker <id> — <slug>` header
2. Metadata block: Model · Thinking · Effort · Branch · Worktree · Phase · Depends on · Parallel with
3. `## Universal Rules (TL;DR)` — copy verbatim from existing worker prompts; do not re-derive
4. `## Your Mission` — narrative description of what the worker is building and why
5. `## Tests (per test-coverage discipline)` — concrete bullets of what to cover
6. `## TDD steps` — numbered list of failing-test-first → green commits
7. `## Files` — files to create/modify, link-style with relative paths
8. `## Verification checklist` — concrete bullets ending with `Manifest row → done` and `PR opened`
9. `## Out of scope` — explicit non-goals so the worker doesn't expand the PR

The manifest row in `docs/workers/MANIFEST.md` should already be set to `ready` once the prompt file lands.

## 2. Hard-won knowledge from merging Phase 1

The merge of 16 Phase 1B PRs surfaced patterns the prompt-writer should bake into future prompts. Including these explicitly in each prompt avoids re-learning them mid-execution.

### 2.1 The MANIFEST.md manifest is a perpetual conflict surface

Every worker updates its own row in `docs/workers/MANIFEST.md` (to `in-progress`, then `done`). When N workers run in parallel, every merge after the first introduces a manifest conflict. The resolution is mechanical (keep base + apply this row's new status) but it has to happen.

**For each prompt:** state that the worker MUST do the manifest update as its own dedicated `chore(manifest):` commit — never bundle it with code commits. This keeps rebases tractable later.

### 2.2 The merge-order eslint trap

Worker 07 introduced `react/no-multi-comp`. Workers 09, 36, 0f wrote multi-component files in branches that diverged before 07. CI was green in each branch in isolation, but the merged base failed lint. The fix was a direct push to base that extracted sub-components into sibling files: `ChevronUpSvg`/`ChevronDownSvg` (NumberWithLookupField), `PathValueInput`/`PathVariableCard` (VariableCard), inline `StepNodes` into `Harness` (useScrollToAffectedStep test).

**For each new prompt:** require one component per file from the start. The eslint rule is now load-bearing; if a sub-component is needed, it goes in its own sibling file. Test files included.

### 2.3 Worker 36 reshaped the YAML codec

Worker 36 (`variables-system-foundation`) restructured the YAML serializer so `paths:` is now a derived view over a unified `variables:` block. The old code path that wrote `paths: pathsObj` was replaced by `variables: variablesObj` (typed entries with `type: "path" | "threadCount" | ...`).

Deferred workers `11` (threadCount serialization) and `19` (yamlSerializer + loadYaml merged into yamlCodec) couldn't auto-rebase onto worker 36 — their textual diffs collide with worker 36's topology change. They need re-derivation.

**For any future prompt that touches YAML serialization or path/variable persistence:** assume worker 36's codec is the baseline. Add new variable types by registering with `VariableCard/registry.ts` and extending the `variables` block — do not write to a top-level `paths:` or invent a new top-level key.

### 2.4 ApiRunModal → SequenceRunModal rename + state shape change (worker 17)

Worker 17 renamed `ApiRunModal` → `SequenceRunModal` and changed the state atom from `ApiRunState | null` to a discriminated union: `{ mode: "closed" } | { mode: "open" | "background", jobId, status, logs, activeChildren, source }`.

**For any future prompt that touches the modal or job-run lifecycle:** use the new names and respect the discriminated union. The `mode` field is required; setting a state object without it is a type error.

### 2.5 Dry-run state lives in the URL (worker 14)

Worker 14 migrated `dryRunAtom` and `failureModeAtom` from `localStorage` to the `?fake=success|failure` query string. The atoms are now thin projections over a `fakeParamAtom` that reads/writes the URL on every access (with a `urlVersionAtom` + popstate listener for reactivity).

**For prompts touching dry-run:** read/write the atoms; do NOT touch `localStorage["isDryRun"]` or `localStorage["dryRunScenario"]` — those keys are dead.

### 2.6 The two-commit TDD pattern is the convention

Every worker prompt should require: (1) a failing-test commit (typically `test(<scope>): failing tests for <feature>`), then (2) a separate green-implementation commit. This produces a reviewable red/green record in `git log`. The pattern is enforced in the verification checklist of existing prompts; preserve it.

### 2.7 The gate

`yarn lint → yarn typecheck → yarn test → yarn test:e2e → yarn lint` (lint runs twice — once before and once after, to catch formatting drift introduced by tests). Phrase the gate exactly this way in each prompt's Universal Rules section.

### 2.8 Worktree isolation

Every worker runs in its own git worktree under `.claude/worktrees/<id>_<slug>/`. The branch name in the manifest is `feat/mux-magic-revamp/<id>-<slug>` for some workers and `worker/<id>-<slug>` for others — both have been used. Pick one and standardize across Phase 2+ prompts; this doc recommends `feat/mux-magic-revamp/<id>-<slug>` for consistency.

The worker MUST set a unique `PORT` and `WEB_PORT` env var per worktree so parallel e2e runs don't collide. Existing prompts say "Random PORT/WEB_PORT" — repeat the same phrasing.

## 3. Current state of the codebase that future prompts must respect

### 3.1 Package layout

```
packages/
  server/       # Hono API; cancellable Job lifecycle; webhook reporter (worker 1e)
  tools/        # @mux-magic/tools — published utilities (Phase 0 worker 39 lives here)
  web/          # React + Jotai builder UI; Storybook stories; vitest unit + playwright e2e
```

Note: worker 39 (`shared-to-tools-rename`) is still `ready` in the manifest. The `packages/tools/` directory exists today because worker 01 took on the rename. The 39 prompt may now be a no-op; verify before spawning it. The npm-published name `@mux-magic/tools` is real (worker 02 done; user confirmed `npm publish` works).

### 3.2 Active ESLint rules introduced in Phase 1A

These are now enforced everywhere:

- `react/no-multi-comp` (worker 07) — one React component per file, including in test files. Use sibling files for sub-components.
- `is-has-eslint-rule` (worker 05) — boolean function names and parameters must start with `is`/`has`/`should`/`can`/etc. Applies to `typeProperty` and `parameter` selectors; not `objectLiteralProperty` (so Zod schema keys, body property accesses, and yargs option names are unaffected).
- `web-types eslint guard` (worker 06) — restricts certain imports/types in `packages/web/`.

Future prompts touching code in `packages/web/` or `packages/server/` must produce code that satisfies all three out of the gate.

### 3.3 Variables foundation (worker 36)

- `variablesAtom` is the single source of truth (multi-type).
- `pathsAtom` is a writable derived view (`type === "path"` filter on `variablesAtom`).
- New variable types register via `packages/web/src/components/VariableCard/registry.ts` — each entry declares `label`, `cardinality` (`singleton` | `multiple`), and the React component that renders the card.
- Adding a new variable type (e.g., `threadCount`, `dvdCompareId`) is a small repeatable pattern: define the type, register it, optionally add a custom card. Worker 11 (deferred) and worker 35 (planned) both follow this pattern.

### 3.4 SequenceRunModal (worker 17)

- Path: `packages/web/src/components/SequenceRunModal/`.
- Atom: `sequenceRunModalAtom` (was `apiRunModalAtom`).
- State shape: `{ mode: "closed" } | { mode: "open" | "background", jobId, status, logs, activeChildren, source }`.
- Use `mode: "background"` for run-in-background (the modal stays mounted; SSE stream and accumulated logs survive).

### 3.5 Webhook reporter (worker 1e)

- Path: `packages/server/src/tools/webhookReporter.ts`.
- Three reporters: `reportJobStarted`, `reportJobCompleted`, `reportJobFailed`.
- Each is fire-and-forget; 4xx/5xx/network failures `console.warn` and resolve cleanly.
- Wired in `jobRunner.ts` at the running/completed/failed transitions.

### 3.6 Track ownership (from manifest)

| Track | Owns |
|---|---|
| `tools` | `packages/tools/**`, root configs, `.github/**`, top-level docs, `AGENTS.md` |
| `web` | `packages/web/**` only |
| `srv` | `packages/server/**` only |
| `cli` | `packages/cli/**` (new package, created in Phase 2 worker 20) |
| `cross` | `gallery-downloader` repo (now on Gitea); no mux-magic surface |
| `infra` | CI workflows, vitest configs, playwright config, ESLint/Biome configs |

Two workers in the same phase can run in parallel iff their tracks don't overlap. The README's "Parallel with" line in each prompt should reflect this.

## 4. Deferred Phase 1 PRs that future workers may need to coordinate with

| PR | Worker | Status | Conflict |
|:--:|:--:|:--|:--|
| `#93` | 19 (yaml-codec-merge) | Deferred | Worker 19 wanted to merge `yamlSerializer.ts` + `loadYaml.ts` into `yamlCodec.ts`. Worker 36 then restructured the codec. Needs re-derivation against worker 36's `variables:` block design. |
| `#98` | 11 (limit-execution-threads-ui) | Deferred | Worker 11 adds `threadCount` serialization to `yamlSerializer.ts`. Worker 36's `variablesObj` already owns that namespace; the merge needs to union `paths` entries with a `threadCount` entry under the unified `variables:` block, not write a parallel structure. |

Phase 2 worker 20 (`cli-package-extract`) has only mild overlap with worker 11 (both touch server code) and none with worker 19. It can start in parallel without waiting for these to land.

## 5. Phases 2-6 — what each unwritten prompt needs to specify

The manifest's row text is short; the prompt-writer should expand each into a full prompt. Below are the per-worker hints to incorporate.

### Phase 2 (CLI extraction; serial)

- **20 — `cli-package-extract`:** Create `packages/cli/`. Extract everything from `packages/server/src/cli*.ts` and `packages/server/src/cli-commands/**` that's invokable as a command. Server retains the API surface; CLI consumes shared business logic from `packages/tools/` (or a new internal `packages/shared/` if cleaner). Update `bin/` entries in `package.json` to point at the new CLI package. Decide: does the CLI get its own published npm package, or stay private? Existing prompt convention: keep it published under `@mux-magic/cli` for consistency with `@mux-magic/tools`. Model: Opus (the manifest says High effort + Opus).

- **21 — `observables-shared-split`:** Move rxjs operators and command pipelines into a track that both server and CLI can import. Probably an internal package or a `packages/shared/` revival. Coordinates with worker 20's `packages/cli/` to avoid circular imports.

### Phase 3 (Name Special Features overhaul)

The original `nameSpecialFeatures` command is preserved and renamed to `nameSpecialFeaturesDvdCompareTmdb`. Two new sibling commands are added (`23 nameMovieCutsDvdCompareTmdb`, `34 onlyNameSpecialFeaturesDvdCompare`) plus a shared variable concept (`35 dvd-compare-id-variable`). Workers 25, 26, 27 enhance the renamed command.

- **22 — `nsf-rename-to-dvdcompare-tmdb`:** Pure rename. No behavior change. Updates all references: command name in `packages/server/src/app-commands/`, schema key, web command listing, fixtures, tests.
- **23 — `nameMovieCutsDvdCompareTmdb-new-command`:** New command. Renames movies + moves into directories by edition. Uses TMDB + DVD Compare API. Depends on 22 (so existing code is renamed first) and 35 (DVD Compare ID variable).
- **24 — `source-path-abstraction`:** Unified `SourcePath` control. Field name `sourcePath` (internal); user-facing label "Source Path". Model: Opus. Large refactor across server + web.
- **25 — `nsf-fix-unnamed-overhaul`:** Improve handling of unnamed special features in the renamed command. Depends on 22.
- **26 — `nsf-edition-organizer`:** Edition-aware directory organization. Depends on 25.
- **27 — `nsf-cache-state-persistence`:** Adds `paused` job state (lifecycle: pending → running → paused → complete/failed). Separate `reason` field for human-readable cause (e.g., `reason: user_input`). Depends on 25.
- **34 — `onlyNameSpecialFeaturesDvdCompare-new-command`:** Non-movie variant; no TMDB. Depends on 22 + 35.
- **35 — `dvd-compare-id-variable`:** Registers `dvdCompareId` as a Variable type in the system from worker 36. Multi-instance (`cardinality: "multiple"`). Adds "Step X DVD Compare ID" link picker. Generic pattern (future AniDB / TMDB ID types follow the same shape). Depends on 22 + 36.

### Phase 4 (Server infrastructure)

- **28 (now `41`) — `structured-logging`:** Replace `console.log` with a structured logger in `@mux-magic/tools`; bridge to `appendJobLog`; AsyncLocalStorage trace correlation via synthetic-uuid `startSpan`. No OTel — single-server self-hosted means there's no collector to ship to. Model: Sonnet/Medium. Depends on 21. Slot `28` was reassigned to a Phase 1B follow-up before the Phase 4 prompts were written; this worker now lives at `41`.
- **2a — `server-template-storage`:** Server-side persistence for sequence templates.
- **2b — `error-persistence-webhook`:** Persist errors and surface via the webhook reporter from worker 1e. Depends on 28.
- **2c — `pure-functions-sweep`:** Refactor side-effectful helpers into pure functions where possible. Depends on 20.
- **38 — already has a prompt.** Skip.

### Phase 5 (HA + advanced features; parallel)

- **2e — `trace-moe-anime-split`:** Anime episode identification via trace.moe + automatic file splitting. Depends on 24 + 38.
- **2f — `ffmpeg-gpu-reencode-endpoint`:** Server endpoint for GPU re-encoding. Model: Opus confirmed (AI struggles without a browser to test; failure mode is "looks right, doesn't work"). Depends on 28.
- **30 — `gpu-aspect-ratio-multi-gpu`:** Multi-GPU aspect-ratio adjustment.
- **31 — `duplicate-manga-detection`:** Cross-references gallery-downloader manga library. Depends on 1d (now merged).
- **32 — `command-search-tags`:** Tag-based search in the command picker.

### Phase 6 (Final consolidation; merges to master)

- **33 — `final-merge-and-cleanup`:** Final pre-merge sweep. User performs manual smoke testing in addition to the standard gate. Depends on all Phase 5 done.

## 6. Resolved open questions (do not re-litigate)

These were originally `?` in the plan; they now have decided answers and the prompt-writer should treat them as fixed:

- **Worker 11 thread-count config:** Per-job setting, not server-persisted. Env var (`DEFAULT_THREAD_COUNT`) is the system ceiling; user picks per-sequence value via UI (clamped). Stored in YAML template + URL query string. Server exposes `GET /system/threads` for the UI to display the ceiling.
- **Worker 22 NSF rename:** Keep existing code; rename only. Add two new sibling commands (23 and 34) + shared DVD Compare ID variable (35). Original command stays so behaviour can be compared before deprecating.
- **Worker 24 source-path naming:** `sourcePath` internal, "Source Path" user-facing. No further question.
- **Worker 27 paused state:** State name is `paused` (clean lifecycle: pending → running → paused → complete/failed). Separate `reason` field for human-readable cause (e.g., `reason: user_input`).
- **Worker 2f model:** Opus confirmed for FFmpeg GPU re-encode — failure mode is "looks right, doesn't work" and AI struggles without a browser to verify.
- **Worker 33 smoke testing:** Manual testing required in addition to standard gates. User performs the manual pass; this worker doesn't automate beyond gates.

## 7. Memory pointers

- The mux-magic project memory at `C:\Users\satur\.claude\projects\d--Projects-Personal-mux-magic\memory\` tracks the live state of merged/deferred PRs. It's local to the user's machine; do not include this path in any committed file.
- The plan document referenced from `docs/workers/MANIFEST.md` lives at `C:\Users\satur\.claude\plans\claude-huge-revamp-idempotent-otter.md` (also user-local).

Both are sources the prompt-writer can read for additional context; neither should be treated as the source of truth over what's actually in the codebase today.
