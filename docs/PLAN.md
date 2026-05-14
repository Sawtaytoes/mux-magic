# Mux-Magic Huge Revamp — Master Plan

This is the full plan document for the Mux-Magic huge revamp. The live worker tracker is in [workers/README.md](workers/README.md); each worker has a dedicated prompt file in [workers/](workers/).

## Context

Two repos get reworked in coordination:

- **Mux-Magic** (currently named `Mux-Magic`) — video processing tools. Rebrand happens in Phase 0; final name is `Mux-Magic` with the hyphen.
- **Gallery-Downloader** (currently `media-sync`, in `D:\Projects\Personal\media-sync`) — comic + image gallery downloader. Name decided: `Gallery-Downloader`.

In addition to the rebrand, three cross-cutting architectural changes shape the plan:

1. **Shared-variables system** — generalizes today's path-variables into a typed set of named sequence-level values (paths, DVD Compare IDs, thread count, future TMDB/AniDB IDs). Lives in a new "Edit Variables" modal + right-sidebar UI (replaces inline cards in the sequence list).
2. **Per-job thread budget** — today the task scheduler has one global concurrency cap (`MAX_THREADS`). New: each job declares a per-job claim; the scheduler enforces BOTH `inflight-global < MAX_THREADS` AND `inflight-this-job < claim`. Lets two jobs share the pool fairly (e.g. 4-thread + 8-thread jobs both run; 8-thread one is starved to 4 until the 4-thread one finishes).
3. **Per-file pipelining** (Phase 4) — each file streams through the full sequence independently. Today step B waits for step A to finish ALL files; new model is rxjs composition where file 1 hits step 3 while file 2 is still on step 1.

Both products today are coupled: Gallery-Downloader (Media-Sync) calls Mux-Magic over HTTP. The revamp **decouples them**: Home Assistant becomes the orchestrator that triggers both products via webhooks, and both products report status back via outbound webhooks. Neither product calls the other in the new architecture.

**Webtoons list ownership:** stays in Gallery-Downloader via a `WEBTOONS_LIST_SOURCE` env var (URI form, accepting `file://` or `https://`). HA just triggers a named job like `sync-webtoons`; the renamed product reads its own env var to know what to sync.

Goals:

1. The orchestrator AI is a **prompt writer**, not the implementer. This plan produces ~54 worker prompt files in [workers/](workers/), each consumable by a fresh Claude Code session.
2. **Sequential hex IDs** (`01_<slug>.md`, `02_<slug>.md`, … through `38_<slug>.md`) so they're visually ordered. Execution order driven by the Markdown manifest table, not the filename.
3. **One long-lived feature branch** `feat/mux-magic-revamp` cut from master in each repo. Each worker = worktree on a sub-branch, PRs into `feat/mux-magic-revamp`. Master merges only at explicit phase boundaries.
4. **Cross-repo workers** run in worktrees inside `D:\Projects\Personal\media-sync` and coordinate with the Mux-Magic rename + decoupling.

Out of scope: Docker deploy pipeline tuning, NAS migration, anything outside the source task doc.

---

## 1. Worker Addressing & Manifest

### File naming

`workers/<hex>_<slug>.md` where `<hex>` is two lowercase hex chars assigned sequentially: `01, 02, …, 09, 0a, 0b, …, 0f, 10, …, 38`. Slug is kebab-case, descriptive.

Examples:

- [workers/01_mux-magic-rename.md](workers/01_mux-magic-rename.md)
- [workers/0a_json-field-readonly.md](workers/0a_json-field-readonly.md)
- [workers/1c_gallery-downloader-decouple-and-ha-endpoint.md](workers/1c_gallery-downloader-decouple-and-ha-endpoint.md)

**ID assignment rule:** sequential 2-hex (256 possible codes; ~54 in use). When inserting a new worker mid-plan, use the next unused code and let the table column for `phase` carry the real ordering. Never renumber.

### Manifest

The live tracking table is at [workers/README.md](workers/README.md). This file (PLAN.md) is the reference for context + architecture decisions + flow chart; the README is the scannable per-worker tracker.

Status values: `planned` → `ready` → `in-progress` → `blocked` → `done`. Workers update their own row when they start and finish.

### Tracks (file-domain heuristics for collision detection)

| Track | Owns |
|---|---|
| `tools` | `packages/tools/**` (renamed from `packages/shared/**` in worker 39), root configs, `.github/**`, top-level docs, AGENTS.md |
| `web` | `packages/web/**` only |
| `srv` | `packages/server/**` only |
| `cli` | `packages/cli/**` (new package created in Phase 2) |
| `cross` | `Gallery-Downloader` repo + cross-repo coordination |
| `infra` | CI, vitest configs, playwright config, ESLint/Biome configs |

Same-phase workers may run in parallel only if their file globs do not overlap.

---

## 2. Branch Model

```
Mux-Magic repo:                       Gallery-Downloader repo:

master                                master
  │                                     │
  └─ feat/mux-magic-revamp              └─ feat/gallery-downloader-revamp
       │                                     │
       ┌─ feat/mux-magic-revamp/01-rename    ┌─ feat/gd-revamp/1b-rename
       ┌─ feat/mux-magic-revamp/02-npm-key   ┌─ feat/gd-revamp/1c-decouple
       └─ … (one branch per Mux-Magic        └─ … (one branch per
            worker, worktrees at                    cross-repo worker,
            .claude/worktrees/<hex>_<slug>/)        worktrees in GD's
                                                    .claude/worktrees/)
```

**Branch naming:** `feat/mux-magic-revamp/<hex>-<short-slug>` in the Mux-Magic repo; `feat/gallery-downloader-revamp/<hex>-<short-slug>` in Gallery-Downloader.

**Worktree path:** `.claude/worktrees/<hex>_<slug>/` (underscores match file name; hyphens in branch name).

**Merge flow:**

1. Worker pushes sub-branch + opens PR into the integration branch.
2. User reviews + merges (or auto-merges when AGENTS.md gates pass).
3. At phase boundaries marked `merges-to-master`, the integration branch rebases on master and opens a PR back to master.

**Merge-to-master points:**

- **End of Phase 0** — rebrand published; `@mux-magic/tools` available on npm (renamed from `@mux-magic/tools` by worker 39); Gallery-Downloader uses it.
- **End of Phase 6** — full revamp ships.

No intermediate master merges.

---

## 3. Phase Boundaries & Merge-to-Master Points

| Phase | Title | Workers | Merges to master? |
|:---:|---|---|:---:|
| 0 | Rebrand foundation | 39 → 01, plus 02 03 04 (parallel) | **YES** |
| 1A | High-blast-radius (ESLint config, serial) | 05 → 06 → 07 | No |
| 1B | Improvements (parallel fan-out with Variables foundation sub-chain) | 08–1f + 36, 37 (26 workers; 36 → 37 serial sub-chain blocks 11+35+37) | No |
| 2 | CLI package extraction | 20 → 21 | No |
| 3 | Name Special Features overhaul | 22–27 + 34, 35 (8 workers) | No |
| 4 | Server infrastructure + per-file pipelining | 28–2d + 38 + 3b + 3c (9 workers) | No |
| 5 | HA + advanced features | 2e–32 | No |
| 6 | Final consolidation | 33 | **YES** |

---

## 4. Dependency Flow (ASCII)

```
                                master  ─────────────────┐
                                  │                      │
                                  ▼                      │
        ┌────────────────────────────────────────┐       │
        │  PHASE 0  ── Rebrand foundation        │       │
        │  Run 39, 02, 03, 04 in parallel first  │       │
        │  Run 01 after (avoids AGENTS.md churn  │       │
        │  AND inherits the tools/ rename)       │       │
        │                                        │       │
        │   39 shared-to-tools-rename Sonnet/H   │       │
        │   02 npm-publish-key        Haiku/L    │       │
        │   03 storybook-vitest-fix   Sonnet/M   │       │
        │   04 worker-conventions     Haiku/L    │       │
        │        ▼                               │       │
        │   01 mux-magic-rename       Sonnet/H   │       │
        └─────────────────┬──────────────────────┘       │
                          │                              │
                          ▼   ═══ MERGE TO MASTER ═══════│
                          │                              │
                          ▼                              │
        ┌────────────────────────────────────────┐       │
        │  PHASE 1A ── ESLint config (SERIAL)    │       │
        │                                        │       │
        │   05 is-has-eslint-rule                │       │
        │        ▼                               │       │
        │   06 webtypes-eslint-guard             │       │
        │        ▼                               │       │
        │   07 one-component-per-file            │       │
        └─────────────────┬──────────────────────┘       │
                          │                              │
                          ▼                              │
        ┌────────────────────────────────────────┐       │
        │  PHASE 1B ── Improvements (PARALLEL)   │       │
        │                                        │       │
        │   ★ Foundation sub-chain (SERIAL):     │       │
        │     36 variables-system-foundation     │       │
        │        ▼                               │       │
        │     37 edit-variables-modal-and-sidebar│       │
        │                                        │       │
        │   Web (most run in parallel with 36/37):│      │
        │     08 09 0a 0b 0c 0d 0e 0f            │       │
        │     10 12 13 14 15 16 17               │       │
        │     11* (waits for 36 — uses Variables)│       │
        │                                        │       │
        │   Other (3, all parallel):             │       │
        │     18 loadenvfile                     │       │
        │     19 yaml-codec-merge                │       │
        │     1a reorder-tracks-skip             │       │
        │                                        │       │
        │   Cross-repo (5):                      │       │
        │     1b media-sync-rename               │       │
        │        ▼                               │       │
        │     1c decouple+HA-endpt               │       │
        │        ▼                               │       │
        │     1d consume-mux-magic-shared        │       │
        │     1e mux-magic-webhooks (parallel)   │       │
        │     1f anime/manga-commands (parallel) │       │
        └─────────────────┬──────────────────────┘       │
                          │                              │
                          ▼                              │
        ┌────────────────────────────────────────┐       │
        │  PHASE 2 ── CLI extraction (SERIAL)    │       │
        │                                        │       │
        │   20 cli-package-extract     Opus/H    │       │
        │        ▼                               │       │
        │   21 observables-shared-split          │       │
        │   32 lookup-types-from-server (parallel│       │
        │      — depends on 01, 06 only)         │       │
        └─────────────────┬──────────────────────┘       │
                          │                              │
                          ▼                              │
        ┌────────────────────────────────────────┐       │
        │  PHASE 3 ── Name Special Features      │       │
        │                                        │       │
        │   22 nsf-rename-to-dvdcompare-tmdb     │       │
        │        │                               │       │
        │        ┌─→ 23 movieCutsDvdCompareTmdb  │       │
        │        ┌─→ 34 onlyNameSpecialFeatures  │       │
        │        ┌─→ 35 dvd-compare-id-variable  │       │
        │        ┌─→ 24 source-path-abstraction  │       │
        │        ▼                               │       │
        │   25 fix-unnamed-overhaul              │       │
        │        ┌─→ 26 editions                 │       │
        │        └─→ 27 cache+state (paused job) │       │
        └─────────────────┬──────────────────────┘       │
                          │                              │
                          ▼                              │
        ┌────────────────────────────────────────┐       │
        │  PHASE 4 ── Server infrastructure      │       │
        │                                        │       │
        │   28 structured-logging-otel Opus/H    │       │
        │        ▼                               │       │
        │   2b error-persistence-webhook         │       │
        │                                        │       │
        │   38 per-file-pipelining     Opus/H    │       │
        │      (depends on 20+21+28)             │       │
        │                                        │       │
        │   Parallel with 28+38:                 │       │
        │     29 openapi-codegen-optional        │       │
        │     2a server-template-storage         │       │
        │     2c pure-functions-sweep            │       │
        │     2d asset-fallback-to-cli           │       │
        │     3b extract-subs multi-lang+type    │       │
        │     3c bcp47-language-variants         │       │
        │     3e gallery-downloader-task-pools   │       │
        │     40 file-organization-commands      │       │
        └─────────────────┬──────────────────────┘       │
                          │                              │
                          ▼                              │
        ┌────────────────────────────────────────┐       │
        │  PHASE 5 ── HA + advanced (PARALLEL)   │       │
        │                                        │       │
        │   2e trace-moe-anime-split             │       │
        │      (depends on 24 + 38)              │       │
        │   2f ffmpeg-gpu-reencode    Opus/H     │       │
        │   30 gpu-aspect-ratio-multi-gpu        │       │
        │   31 duplicate-manga-detection         │       │
        │   32 command-search-tags               │       │
        └─────────────────┬──────────────────────┘       │
                          │                              │
                          ▼                              │
        ┌────────────────────────────────────────┐       │
        │  PHASE 6 ── Final consolidation        │       │
        │                                        │       │
        │   33 final-merge-and-cleanup           │       │
        └─────────────────┬──────────────────────┘       │
                          │                              │
                          ▼   ═══ MERGE TO MASTER ═══════┘
```

**Reading the chart:**

- Top-down = strict phase ordering.
- Multiple workers in a single box = parallel-eligible (run in their own worktrees).
- `→` arrows inside a box = serial dependency.
- Phase 1A is 3 workers in a strict chain (ESLint config conflicts force serialization).
- Phase 1B has 26 workers — 24 parallel-eligible (the widest fan-out in the plan) plus 2 in a Foundation serial sub-chain (36 → 37) that blocks workers 11, 35, 37.
- Mux-Magic master receives the integration branch only twice: after Phase 0 and after Phase 6.

---

## 5. Architecture decisions (cross-cutting)

Three decisions ripple through multiple workers. Each worker's prompt references back here instead of re-deriving.

### 5.A — Shared Variables system (workers 36, 37; consumed by 11, 35)

**Today:** `PathVariable = { id, label, value }` stored in `pathsAtom`. Each step links via `step.links[fieldName] = pathVariableId`. YAML encodes them under a `paths:` root block; serialized link references use `@<id>` prefix.

**New:** `Variable = { id, label, value, type }` — type discriminator added. Supported types ship in workers:

- `path` (refactored from today's PathVariable — multi-instance, named)
- `threadCount` (worker 11 registers — **singleton** per sequence)
- `dvdCompareId` (worker 35 registers — multi-instance, named, references TheMovieDB/DVD Compare lookups)
- Future: `tmdbId`, `anidbId`, etc. — add by registering a new type in the system

Cardinality rules per type (singleton vs multi) live with the type registration. The Edit Variables modal (worker 37) handles both via a type-aware "Add" UI.

**Back-compat:** YAML codec reads legacy `paths:` block as `Variable[]` with `type: "path"`. Writes the new unified `variables:` block. After full revamp, `paths:` can be deprecated; for now, both shapes round-trip.

**Step linking unchanged:** `step.links[fieldName] = variableId`; resolution looks up by ID and dispatches on `type` if needed.

**UI:** Variables move OUT of the inline sequence list. They live in:

1. **Edit Variables modal** (worker 37, primary surface) — central CRUD across all types.
2. **Right-sidebar view on large screens** (worker 37) — mirror of modal contents.

### 5.B — Per-job thread budget (worker 11)

**Today:** `taskScheduler.ts` uses rxjs `mergeAll(concurrency)` where `concurrency = MAX_THREADS` (env-var-driven, defaults to `os.cpus().length`). A single global pool; all jobs compete fairly.

**New:** two coupled constraints enforced on task admission:

1. `inflight-global < MAX_THREADS` (existing, preserved)
2. `inflight-this-job < job.claim` (new — each job declares its desired-max via the `threadCount` Variable)

Implementation: tag each task with its `jobId` at submission. The scheduler tracks in-flight counts per job. When checking admission, both constraints must hold.

**Env vars:**

- `MAX_THREADS` (existing) — system ceiling. If unset, defaults to `os.cpus().length`.
- `DEFAULT_THREAD_COUNT` (NEW) — default per-job claim value. If `≤ 0`, treated as "use MAX_THREADS" (no per-job restriction). Default `2` (safe for most machines).

**Effective default per-job claim:** `defaultThreadCount <= 0 ? maxThreads : min(maxThreads, defaultThreadCount)`.

**Per-job override:** user picks via the Variables system. Value clamped to `MAX_THREADS` at runtime regardless of what's stored.

**Concurrent jobs example** (8-core CPU, MAX_THREADS=8):

- Job A claims 4 → uses up to 4 slots
- Job B claims 8 → can use up to 4 (8 − 4 already taken by A) until A finishes; then up to 8

### 5.C — Per-file pipelining (worker 38)

**Today:** sequence runner does `await runStep(stepA, allFiles); await runStep(stepB, allFiles);`. Each step's command handler typically calls `.pipe(toArray())` on the file Observable, materializing the whole set before processing. Step B doesn't start until step A is done with ALL files.

**New:** sequence runner composes steps with rxjs streaming. File 1 leaves step A's `mergeMap` and enters step B before step A is done with file 2. The full file list never gets materialized to an array.

**Implementation scope:**

- Rewrite `sequenceRunner.ts` to compose steps as observable transforms (not `await runStep` loops).
- Update every command handler that currently `toArray()`s the file list. Most can drop the `toArray()` and let rxjs back-pressure handle ordering.
- Update `getFilesAtDepth` callers if they rely on full-set knowledge (e.g. pre-calculating total size for progress).
- Multiplies the value of worker 11's per-job thread budget — without pipelining, a 32-thread job that only has 4 files spends most of the budget idle.

**Out-of-scope for worker 38** but might emerge later:

- Per-step thread caps (worker 11 only does per-sequence).
- File-level retry on partial pipeline failures (currently job-level retry only).

---

## 6. Worker Prompt Template

Every worker prompt file follows this structure. When a worker is spawned, paste the contents of the `.md` file into a fresh Claude Code session as the first message.

```markdown
# Worker <ID> — <Title>

**Model:** <model> · **Thinking:** <ON|OFF> · **Effort:** <Low|Medium|High>
**Branch:** `feat/mux-magic-revamp/<id>-<short-slug>`
**Worktree:** `.claude/worktrees/<id>_<slug>/`
**Phase:** <N>
**Depends on:** <comma-separated IDs or "none">
**Parallel with:** <comma-separated IDs>

---

## Universal Rules

1. **Branch & worktree** — create your worktree at `.claude/worktrees/<id>_<slug>/`; all work happens in that worktree.
2. **Port + PID convention** — set random PORT/WEB_PORT; capture PID; tear down only your own.
3. **Pre-push gate (in order):** `yarn lint → yarn typecheck → yarn test`. Re-run `yarn lint` last if you changed typecheck/test/e2e code.
4. **Pre-merge gate:** `yarn e2e` against your own PORT/WEB_PORT.
5. **TDD:** failing test first, then implement.
6. **Commit-and-push as you go.** Update your row in workers/README.md.
7. **Test rules:** no snapshot tests, no screenshot tests, no VRT. Inline expected values.
8. **Package manager:** `yarn` only.

---

## Your Mission

<concrete task description, root cause if known, files to change>

## TDD steps

1. ...

## Files

- <list with markdown links>

## Verification checklist

- [ ] Standard gates clean
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] workers/README.md row updated to `done`
```

---

## 7. AGENTS.md Updates Needed (worker `04`)

Worker `04` edits AGENTS.md:

1. **Worker port/PID section (new)** — PowerShell + Bash snippets for setting random ports + capturing PID.
2. **Pre-push gate order (updated)** — `lint → typecheck → test → e2e → final lint`.
3. **Worker role section (updated)** — Primary vs. Worker.
4. **Worker addressing pointer (new)** — short paragraph pointing to workers/README.md.
5. **Test coverage discipline (new)** — tests must match change scope; e2e for cross-component flows.

Same update happens in Gallery-Downloader's AGENTS.md as part of worker `1b` (rename) or `1c` (decouple).

---

## 8. High-Blast-Radius Sequencing

**Phase 1A serial workers — all three touch `eslint.config.js`:**

- `05` is-has-eslint-rule
- `06` webtypes-eslint-guard
- `07` one-component-per-file

Cannot parallelize — each adds a rule + lint sweep, so concurrent edits would conflict on every line of `eslint.config.js`.

**Phase 1B Foundation sub-chain — workers 36 → 37 touch the Variables system:**

- `36` variables-system-foundation (atoms, types, YAML, UI primitive)
- `37` edit-variables-modal-and-sidebar (depends on 36 — UI surface that consumes the foundation)

Serial because 37 imports the new types/atoms from 36. Workers 11 and 35 also depend on 36 (but not 37 — they ship their own UI surfaces).

**Other multi-touched files (handled via single-owner workers):**

| File | Owner worker(s) | How |
|---|---|---|
| Root `package.json` | `01` rename, `18` loadenvfile, `20` cli-extract, `39` shared→tools | Sequenced |
| `packages/server/package.json` | `01`, `18`, `20`, `2d`, `39` (selective tool moves) | Same sequence |
| `packages/web/package.json` | `01`, `18` | Sequence |
| `packages/shared/` directory | `39` (renames → `packages/tools/`) | Single-owner |
| AGENTS.md | `04` (full pass); progress lines go in workers/README.md | Single-owner |
| workers/README.md | Every worker updates its own row only | Line-isolated; merge-safe |
| NSF command files | Phase 3 workers — strictly sequential | Enforced by dependency chain |

**Recommendation:** start Phase 1B fan-out workers only after Phase 1A's three serial workers complete.

**Phase 0 ordering:** worker `39` (shared→tools rename + selective server-tools migration) must merge before worker `01` (mux-magic rebrand), so `01` only deals with `@mux-magic/tools` (not the older `@mux-magic/tools`). Workers `02`, `03`, `04` are unaffected by `39` and can run in parallel with it.

---

## 9. Resolved Decisions

| Worker | Decision |
|:--:|---|
| 39 | **`packages/shared/` renames to `packages/tools/`** and the npm scope becomes `@mux-magic/tools`. Reusable utilities currently under `packages/server/src/tools/` (console log helpers, file lookups, anything not tied to this server's API) move into `packages/tools/`. Gives Gallery-Downloader a single npm dep instead of duplicating those utilities. Runs in Phase 0 before worker 01 so 01 only handles `@mux-magic/tools` references. |
| 1b | **Gallery-Downloader** is the final name for the renamed Media-Sync. |
| 22 | **Keep existing code; rename only** → `nameSpecialFeaturesDvdCompareTmdb`. Two NEW sibling commands (23 `nameMovieCutsDvdCompareTmdb` and 34 `onlyNameSpecialFeaturesDvdCompare`) plus shared DVD Compare ID variable type (35). |
| 27 | **`paused`** state (clean lifecycle: pending → running → paused → complete/failed). Separate `reason` field for human-readable cause. |
| 11 | **Per-job claim, not server-persisted.** Env var `MAX_THREADS` stays as ceiling; new env var `DEFAULT_THREAD_COUNT` (default 2; ≤0 means use MAX_THREADS). User picks per-sequence value via the Variables system (singleton `threadCount` type). |
| 24 | **`sourcePath` internal, "Source Path" user-facing.** |
| 2f | **Opus confirmed** for FFmpeg GPU work. |
| 33 | **User performs manual smoke testing** before the merge worker opens the master PR. |

---

## 10. Model Recommendation Confidence

| Confidence | Workers |
|---|---|
| **High** (mechanical / well-bounded) | 02, 03, 04, 0a, 0b, 0e, 10, 12, 13, 18, 2d, 32 |
| **Medium** (judgment calls, standard patterns) | 01, 05, 06, 07, 08, 09, 0c, 0d, 0f, 11, 14, 15, 16, 17, 19, 1a, 1b, 1c, 1d, 1e, 1f, 21, 22, 23, 25, 26, 27, 29, 2a, 2b, 30, 31, 33, 34, 35, 36, 37, 39 |
| **Low — model recommendation uncertain** | **20, 24, 28, 2c, 2f, 38** — all currently Opus or High-effort Sonnet. These are where Opus's cost may be justified by failure-mode severity. Revisit per worker. |

---

## 11. Verification

1. **Phase 0 dry run** — spawn worker `04` first (smallest blast radius). Verify it can: set its own random ports, capture PID, run the full gate, open a PR, update its row. If `04` succeeds end-to-end, the worker template is validated.
2. **Manifest sanity check** — verify no duplicate IDs, every "depends on" reference resolves, every "parallel with" reference is bi-directional.
3. **Cross-repo readiness** — verify Gallery-Downloader repo is clean before `1b`/`1c`/`1d` spawn.
4. **At each phase boundary marked `merges-to-master`:** all workers `done`; integration branch rebases cleanly; full gates clean; manual smoke test through web UI.

---

## 12. Out of Scope

- Docker deploy pipeline (worker `01` only touches package names in `.github/workflows/deploy.yml`).
- NAS / storage migration.
- Anything in [archive/](archive/).
- Performance tuning beyond `copyFile` exception in worker `2c`.
- Anything not in the source task doc.
