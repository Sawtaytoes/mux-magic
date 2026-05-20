# Worker 42 — foreach-folder-bulk

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/42-foreach-folder-bulk`
**Worktree:** `.claude/worktrees/42_foreach-folder-bulk/`
**Phase:** 5
**Depends on:** 27 (paused state + state persistence), 35 (`dvdCompareId` Variable type), 36 (Variables foundation — done), 25 (per-release answer cache; soft — bulk works without it but reuses it)
**Parallel with:** any Phase 5 worker that doesn't touch [packages/api/src/api/sequenceRunner.ts](../../packages/api/src/api/sequenceRunner.ts), [packages/api/src/api/routes/sequenceRoutes.ts](../../packages/api/src/api/routes/sequenceRoutes.ts), [packages/web/src/types.ts](../../packages/web/src/types.ts), or [packages/web/src/components/InsertDivider/InsertDivider.tsx](../../packages/web/src/components/InsertDivider/InsertDivider.tsx).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

The user has ~700 disc-rip subfolders under `G:\Disc-Rips`. Running **Name Special Features (DVD Compare + TMDB)** ([packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts)) by hand against each is impractical: each invocation needs a DVD Compare ID, frequently asks for user input mid-run (Phase-B duplicate-file prompts via `getUserSearchInput`), and some folders cannot be matched at all.

This worker introduces **iteration at the sequence level** — a new group kind that runs its child steps once per matched subfolder of a parent directory, plus the supporting infrastructure (centralized registry file, pre-flight consistency check, "needs attention" review queue, `InsertDivider` redesign). The NSF command itself stays untouched.

Full design rationale lives at the plan file the user approved this from — keep this prompt as the implementation spec.

## Your Mission

### 1. New group kind — `forEachFolder`

Add a third group kind alongside today's sequential and parallel groups. Schema lives in:

- Web type: [packages/web/src/types.ts](../../packages/web/src/types.ts) (~lines 24–61) — extend `Group` with a `kind: "sequential" | "parallel" | "forEachFolder"` discriminator (or add a new sibling type — choose whichever requires less churn at the call sites).
- Server schema: [packages/api/src/api/routes/sequenceRoutes.ts](../../packages/api/src/api/routes/sequenceRoutes.ts) (~lines 368–379) — accept the new kind plus its config fields (see config table below).

A `forEachFolder` group carries this config:

| Field | Type | Default | Notes |
|---|---|---|---|
| `parentPath` | path Variable link | required | The directory containing per-movie subfolders. |
| `excludePatterns` | `string[]` glob | `[]` | e.g. `ANIME/**`, `_archive/**`. |
| `onInteractiveInput` | `"pause" \| "skip"` | `"pause"` | `pause` = sub-job goes to `paused` (worker 27), bulk continues; `skip` = sub-job goes to `skipped` with `needs-attention`, bulk continues. Always reports either way. |
| `onMissingEntry` | `"prompt" \| "skip"` | `"skip"` | Behavior when a folder has no entry in the central registry. |
| `concurrency` | `number` | `1` | Per-folder concurrency. Defaults to serial (NSF prompts are easier to handle one at a time). |

### 2. Centralized registry file — `<parentPath>/.mux-magic.yaml`

A single YAML file at the root of `parentPath` keyed by **subfolder name** (relative, not absolute):

```yaml
# G:\Disc-Rips\.mux-magic.yaml
special_features:
  "Some-Movie":
    dvdCompareId: "tt1234567"
    releaseHash: "abc123"        # optional
  "Another-Movie":
    dvdCompareId: "tt7654321"
```

**Why centralized, not per-folder sidecar:** adding a sidecar to each rip folder touches that folder's mtime; the user relies on stable folder mtimes for other tooling. A single registry file at the parent level only modifies one mtime (the parent), not 700. Also gives the user one place to scan/grep/hand-edit and a clean target for the CSV round-trip described below.

**Why YAML (not JSON):** matches the rest of the project's user-facing config; comments allowed; easier to hand-edit. The aspect-ratio JSON file is a separate centralized file consumed by Home Assistant on its own contract — **do not touch, migrate, or reshape it**.

New files:

- `packages/web/src/jobs/centralRegistryCodec.ts` — encode/decode the registry. Mirror the patterns from [packages/web/src/jobs/yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) (including `legacyFieldRenames` style for forward-compat).
- `packages/api/src/api/centralRegistry.ts` — server-side reader that loads `<parentPath>/.mux-magic.yaml` and exposes a per-folder lookup.

### 3. Pre-flight consistency check (load-bearing)

Before any sub-job runs, the runner walks the inputs and aborts loudly on drift:

1. Parse the registry file; report parse errors with line numbers if possible.
2. For every key in the registry, verify the folder exists on disk; report orphan keys.
3. For every folder on disk that survives includes/excludes, note whether it has a registry entry; folders without one go into the "needs attention" bucket per `onMissingEntry`.
4. **If errors exist, halt before running any sub-job** and surface a structured summary so the user can fix the registry and re-run.

This step replaces what would naturally self-resolve with sidecars (sidecar gone = folder gone too); with a central registry, drift is silent unless you check.

### 4. Sequence runner extension

Extend [packages/api/src/api/sequenceRunner.ts](../../packages/api/src/api/sequenceRunner.ts) (currently flattens groups inline ~lines 187–232). When the runner encounters a `forEachFolder` group:

1. Resolve `parentPath` from the linked path Variable.
2. Enumerate subfolders, apply `excludePatterns` (use the new shared glob helper from `packages/tools/src/globMatcher.ts` — see §5).
3. Run the pre-flight check above.
4. For each surviving folder, spawn a **real sub-job** under the bulk parent job using the existing job machinery (`pending → running → paused | completed | failed | skipped`). Set a per-iteration Variable `currentFolder` (path) that the child steps reference via `links` like any other path Variable. Inject the registry's `dvdCompareId` for that folder into the iteration's resolved Variables so the NSF child step transparently satisfies its `dvdCompareId` link without prompting (hooks into worker 35's resolution).
5. When a sub-job needs interactive input:
   - `onInteractiveInput === "pause"` → sub-job goes `paused` (worker 27); bulk runner moves to next folder.
   - `onInteractiveInput === "skip"` → sub-job goes `skipped` with `needs-attention` reason; bulk runner moves on.
6. Honor `concurrency` — default `1` (serial). When > 1, run that many sub-jobs in parallel.

Worker 38's per-file pipelining composes well but is **not** a hard dependency; this should work whether 38 has landed or not.

### 5. Shared glob helper — `packages/tools/src/globMatcher.ts`

Small utility that takes a list of glob patterns and a candidate path and returns whether it matches. Both this worker and the upcoming "Source Path" topper will consume it; extract once instead of inlining twice. Pick a tiny dep (e.g. `picomatch`) or hand-roll if the pattern set is bounded.

### 6. UI changes

#### 6a. `InsertDivider` redesign

Today [packages/web/src/components/InsertDivider/InsertDivider.tsx](../../packages/web/src/components/InsertDivider/InsertDivider.tsx) renders four buttons: `➕ Step`, `➕ Group` (sequential), `➕ Parallel`, `📋 Paste`. Adding `For each folder` would make five — visual clutter and a moving target for every future group kind. Consolidate to **three controls**:

- `➕ Step`
- `➕ Group ▾` — split-button or dropdown listing **Sequential**, **Parallel**, **For each folder**. Default action on plain click stays Sequential (preserves muscle memory); chevron opens the menu.
- `📋 Paste`

API change: `onInsertSequentialGroup` + `onInsertParallelGroup` props collapse into a single `onInsertGroup(kind: GroupKind)`. Update the call site in [packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx](../../packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx) to dispatch on `kind`. Update the Storybook story + tests at [InsertDivider.stories.tsx](../../packages/web/src/components/InsertDivider/InsertDivider.stories.tsx) and [InsertDivider.test.tsx](../../packages/web/src/components/InsertDivider/InsertDivider.test.tsx).

#### 6b. New card — `ForEachFolderCard`

New file: `packages/web/src/components/ForEachFolderCard/ForEachFolderCard.tsx`. Composes the existing [GroupCard](../../packages/web/src/components/GroupCard/) (so dnd-kit nesting + drag-drop logic is inherited unchanged) and adds the config fields from §1. The exclude-pattern input should be extracted as a small shared `GlobPatternList` component in `packages/web/src/components/` so the upcoming Source Path topper can reuse it.

#### 6c. Variables sidebar — scope the per-iteration `currentFolder`

The auto-injected `currentFolder` Variable shows up as a read-only entry inside the `forEachFolder` group's scope while editing child steps, so users can link to it from `sourcePath` fields. Extend [packages/web/src/components/VariablesSidebar/VariablesSidebar.tsx](../../packages/web/src/components/VariablesSidebar/VariablesSidebar.tsx) — do not build a new sidebar.

#### 6d. Review queue — "Needs attention"

New page: `packages/web/src/pages/JobsReviewQueue/`. Tab on the jobs page that lists all `paused` and `skipped`-with-`needs-attention` sub-jobs of the most recent bulk parent. Each row supports:

- **Resume** (for `paused`) — opens the same lookup/duplicate-prompt UI inline.
- **Mark resolved / exclude** — appends the folder's path (or a glob covering it) to the bulk card's `excludePatterns` so subsequent runs skip it.
- **Bulk-export to CSV** (`folder, status, reason`) and re-import with `dvdCompareId` filled in. The importer merges rows into the central `.mux-magic.yaml` registry under `special_features:`.

### 7. Variable resolution

Extend [packages/api/src/api/resolveSequenceParams.ts](../../packages/api/src/api/resolveSequenceParams.ts) to inject `currentFolder` at the per-iteration scope, and to consult the central registry when resolving a `dvdCompareId` link inside a `forEachFolder` iteration (the registry's value wins over an unset Variable; an explicitly-set Variable still wins over the registry — matches the principle "the more specific source wins").

## TDD steps

1. **Codec round-trip** — `centralRegistryCodec` writes a registry, reads it back, asserts deep-equal. Cover: missing optional fields, comments preserved on round-trip if possible, key with hyphens and dots in folder name.
2. **Pre-flight consistency check** — given a tmp dir with a registry covering 2 folders and 3 actual folders on disk, assert: orphan keys reported when a registry-listed folder is missing on disk; missing-entry list reports the third folder; parse-error path produces a structured error not a stack trace.
3. **Glob helper** — `globMatcher` against fixtures: `ANIME/**` matches `ANIME/Cowboy-Bebop` but not `ANIMATED/Foo`; `*.tmp` matches `scratch.tmp` but not `Some-Movie`.
4. **Schema validation** — `sequenceRoutes.ts` accepts a `forEachFolder` group with valid config; rejects one with `concurrency: 0`, missing `parentPath`, etc.
5. **Runner expansion (integration)** — seed a tmp parent with 5 fake folders + a registry covering 2 of them; configure 1 folder excluded by glob, 1 with no registry entry, 1 that triggers a fake duplicate prompt. Run an NSF bulk sequence and assert:
   - Excluded folder produces no sub-job.
   - Registry-listed IDs flow into NSF without a lookup.
   - Folder with no registry entry ends `skipped` with `needs-attention` (under `onMissingEntry: "skip"`).
   - Duplicate-prompt folder ends `paused` (under `onInteractiveInput: "pause"`) or `skipped` (under `"skip"`).
   - Review queue lists exactly the two non-success sub-jobs.
   - Pre-flight halts the run when the registry has an orphan key.
6. **`InsertDivider` redesign** — story + test cover all three group kinds dispatched through `onInsertGroup`; default click-on-`Group` produces a sequential group.
7. **E2E (Playwright)** — drive the builder UI to construct a `forEachFolder` group with one NSF child step, run against a seeded tmp directory, verify the review queue's Resume path completes a paused sub-job.

## Files

### New

- [packages/web/src/jobs/centralRegistryCodec.ts](../../packages/web/src/jobs/centralRegistryCodec.ts)
- [packages/api/src/api/centralRegistry.ts](../../packages/api/src/api/centralRegistry.ts)
- [packages/web/src/components/ForEachFolderCard/](../../packages/web/src/components/ForEachFolderCard/) — `ForEachFolderCard.tsx` + story + test
- [packages/web/src/components/GlobPatternList/](../../packages/web/src/components/GlobPatternList/) — shared exclude-pattern input
- [packages/tools/src/globMatcher.ts](../../packages/tools/src/globMatcher.ts)
- [packages/web/src/pages/JobsReviewQueue/](../../packages/web/src/pages/JobsReviewQueue/)

### Extend

- [packages/api/src/api/sequenceRunner.ts](../../packages/api/src/api/sequenceRunner.ts) — `forEachFolder` expansion + sub-job orchestration
- [packages/api/src/api/routes/sequenceRoutes.ts](../../packages/api/src/api/routes/sequenceRoutes.ts) — schema for the new group kind
- [packages/api/src/api/resolveSequenceParams.ts](../../packages/api/src/api/resolveSequenceParams.ts) — `currentFolder` injection + registry-backed `dvdCompareId` resolution
- [packages/web/src/types.ts](../../packages/web/src/types.ts) — `Group` discriminator
- [packages/web/src/components/InsertDivider/InsertDivider.tsx](../../packages/web/src/components/InsertDivider/InsertDivider.tsx) — collapse to three controls; new `onInsertGroup(kind)` API
- [packages/web/src/components/InsertDivider/InsertDivider.stories.tsx](../../packages/web/src/components/InsertDivider/InsertDivider.stories.tsx)
- [packages/web/src/components/InsertDivider/InsertDivider.test.tsx](../../packages/web/src/components/InsertDivider/InsertDivider.test.tsx)
- [packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx](../../packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx) — call-site dispatch on `kind`
- [packages/web/src/components/VariablesSidebar/VariablesSidebar.tsx](../../packages/web/src/components/VariablesSidebar/VariablesSidebar.tsx) — scoped `currentFolder` rendering

### Reuse — do not reinvent

- NSF command stays untouched: [packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/core/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts) already accepts a `dvdCompareId`; the bulk runner just supplies it.
- `getUserSearchInput` already emits choice events on the SSE channel — worker 27 turns those into a `paused` transition; this worker just consumes it.
- `GroupCard` + dnd-kit handles nesting: [packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx](../../packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx) — `forEachFolder` slots in as another group kind without new drag-drop logic.

## Out of scope (explicit)

- **Folder-name + file-count heuristic identification** of unknown movies. Folders without a registry entry flow into the review queue.
- **Aspect-ratio JSON file** is a separate centralized file consumed by Home Assistant on its own contract — do not touch, migrate, or reshape it.
- **Per-step thread caps inside the bulk loop** — worker 11's per-job thread budget governs.

## Verification checklist

- [ ] Standard gates clean (`lint → typecheck → test → e2e → lint`)
- [ ] All TDD steps pass
- [ ] Manual smoke against `G:\Disc-Rips` with `onInteractiveInput: "skip"` first (read-only enumeration) — confirm the report covers all ~700 folders before flipping to `pause`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
