# Worker 3a — nsf-pipeline-split-into-modules

**Model:** Opus · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/3a-nsf-pipeline-split`
**Worktree:** `.claude/worktrees/3a_nsf-pipeline-split-into-modules/`
**Phase:** 3 (Name Special Features overhaul)
**Depends on:** 22 (rename complete)
**Parallel with:** 24, 35 (different files within NSF family)
**Blocks:** 23, 25, 26, 27, 34 (all benefit from the modular split)

---

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. See [AGENTS.md](../../AGENTS.md). Background context lives in [docs/PLAN.md §9](./PLAN.md).

---

## Your Mission

**Behavior-preserving refactor.** Split [packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts) (1,325 lines, post-worker-22 rename) into focused, independently-testable modules.

The current file uses **two chained `.pipe()` calls** to stay under TypeScript's 9-operator type-inference limit — a tell that the pipeline is too long for the type system, let alone a human reader. Workers 25, 26, 27 each modify a different subsystem of this pipeline; trying to do so against the monolith risks merge conflicts and unintended side effects across subsystems.

This worker carves the monolith into modules along its natural seams. **No behavior changes.** Every existing test must still pass with the same assertions.

---

### Identify the seams (read before doing)

Walk the existing file and map functions to one of these conceptual modules. The exploration already identified the major chunks; use them as starting categories:

1. **DVD Compare integration** — `searchDvdCompare`, URL/ID resolution, HTML parsing. Lives at top of pipeline.
2. **TMDB integration** — `canonicalizeMovieTitle`, year resolution, error handling for missing matches.
3. **Timecode matching** — `getSpecialFeatureFromTimecode`, `findMatchingCut`, padding logic.
4. **Filename helpers** — `parseEditionFromFilename`, `isMainFeatureFilename`, the Plex-suffix list, edition-tag parser.
5. **Unnamed-file fuzzy matching** — `buildUnnamedFileCandidates`, lexicographic word-overlap scoring.
6. **Duplicate-name resolution** — the `scan`-based intra-run counter, `reorderForDuplicatePrompts`, the user-input prompt flow.
7. **Edition folder organization** — `{edition-…}` tag detection, nested folder path construction, the move logic that nests files into `{Title} ({Year})/{Title} ({Year}) {edition-X}/file`.
8. **Result event emission** — building the discriminated union events (single-rename, summary, collision, edition-move).
9. **Pipeline orchestration** — the top-level `.pipe()` chains that compose 1-8 into one observable.

Aim for **8-12 module files** in a new directory `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/` (note: directory has the same name as the command, with the orchestrator becoming `index.ts`).

### Proposed structure

```
packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/
├── index.ts                          # Public entrypoint — exports the orchestrator
├── orchestrator.ts                   # Top-level pipeline composition (was the .pipe chains)
├── dvdCompare/
│   ├── searchDvdCompare.ts           # HTML scrape
│   ├── resolveDvdCompareInput.ts     # url | id | searchTerm → canonical release
│   └── types.ts
├── tmdb/
│   ├── canonicalizeMovieTitle.ts
│   └── types.ts
├── timecode/
│   ├── findMatchingCut.ts
│   ├── findMatchingExtra.ts
│   └── padding.ts
├── filename/
│   ├── parseEditionFromFilename.ts
│   ├── isMainFeatureFilename.ts
│   ├── plexSuffixes.ts
│   └── buildSpecialFeatureFilename.ts
├── unnamed/
│   ├── buildUnnamedFileCandidates.ts # lexicographic scoring
│   └── promptForUserChoice.ts
├── duplicates/
│   ├── reorderForDuplicatePrompts.ts
│   └── duplicateCounter.ts           # the scan-based intra-run counter
├── editions/
│   ├── buildEditionFolderPath.ts
│   └── moveToEditionFolder.ts
├── events.ts                         # discriminated union types + builders
└── types.ts                          # shared types
```

**This is a recommendation, not a contract.** Adjust if a seam doesn't fall cleanly. The goal is "each file does one thing and can be unit-tested in isolation," not strict adherence to this exact layout.

### Refactor rules

1. **No behavior changes.** Every existing test must still pass with the same input/output. If a test fails after a move, the refactor introduced a bug — fix the refactor, not the test.
2. **`git mv` where possible** to preserve blame. For functions that move within a file, that's not possible; just preserve their signatures verbatim.
3. **Pure functions stay pure.** Don't introduce IO or side effects to make refactoring easier; if a function was pure before, it's pure after.
4. **Observable composition** — the orchestrator file should be much shorter than 1,325 lines. The `.pipe()` chains can stay long if necessary, but each operator's inline function should be a one-liner that calls into a module.
5. **No `any` types introduced.** If splitting reveals a type that was previously inferred and now needs an explicit annotation, write the explicit annotation accurately. If a type is too complex to write out, **stop** and discuss; that's a sign the split needs a different seam.
6. **TypeScript 9-operator limit workaround stays where needed.** If after splitting the orchestrator still hits the limit, keep the two-`.pipe()` workaround. This worker isn't tasked with solving that.

### Things that should NOT move

- **The CLI command file** (`packages/cli/src/cli-commands/nameSpecialFeaturesDvdCompareTmdbCommand.ts`) — it stays as-is; its import path updates to `from "@mux-magic/server/app-commands/nameSpecialFeaturesDvdCompareTmdb"` which now resolves to the new directory's `index.ts`.
- **The Zod schema** in `schemas.ts` — unchanged.
- **The route registration** in `commandRoutes.ts` — unchanged.

### After-refactor checklist

For each new module file, ask:

- Does it have a single responsibility?
- Can it be unit-tested without standing up the full observable pipeline?
- Does its name describe what's inside?
- Are its exports the smallest set the orchestrator needs?

If any answer is "no", the seam is wrong — re-split.

---

## Tests (per test-coverage discipline)

The **existing test suite** is the safety net. Every test that passed before this worker must still pass after.

In addition:

- **Unit:** at least one unit test per new module file that **didn't have one before** (the original 1,325-line file is hard to test in isolation; modular files should each get a small focused test).
- **Integration:** the existing end-to-end NSF integration tests (against fixtures) all pass unchanged.
- **e2e:** existing NSF e2e tests pass unchanged.

Do **not** rewrite existing tests as part of this worker. If a test was awkward because the old file was monolithic, leave it — a follow-up worker (or 25/26/27) can clean it up.

---

## TDD steps

This worker inverts the usual TDD: the safety net **already exists** (the suite of tests against the monolith). The discipline is:

1. **Before any move:** run the full test suite. Note the green baseline.
2. Identify the cleanest seam to extract first (probably `dvdCompare/` since it's at the input end of the pipeline).
3. Extract the module; update the orchestrator to import from it.
4. Run the test suite. **It must still pass.** Commit.
5. Repeat for each module. One module per commit.
6. After the orchestrator is hollow (just composition + imports), add the per-module unit tests in a final commit.

If at any point the test suite fails: **don't proceed.** Revert the most recent module-extraction commit, find the regression, fix it, recommit.

---

## Files

**Create (new directory):**
- `packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb/` directory + ~8-12 module files per the proposed structure
- Per-module unit tests

**Move/transform:**
- [packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts](../../packages/server/src/app-commands/nameSpecialFeaturesDvdCompareTmdb.ts) (post-worker-22) → `nameSpecialFeaturesDvdCompareTmdb/index.ts` (or removed entirely if the directory's `index.ts` provides the same export)

**Modify (imports only):**
- CLI command file
- Any test file that imports from the old single-file path

---

## Verification checklist

- [ ] Worker 22 ✅ merged before starting
- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Green baseline noted before any move (record test count + duration in PR description)
- [ ] Each module-extraction is a separate commit
- [ ] Test suite green after every commit (worker can't proceed if any commit broke a test)
- [ ] No new `any` types
- [ ] No behavior change (PR description includes a `git log --oneline` showing only refactor commits)
- [ ] Orchestrator file is dramatically shorter than 1,325 lines (target: <200 lines of composition + imports)
- [ ] Every new module has at least one unit test
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`
- [ ] PR description explicitly states "no behavior change; pure structural refactor"

## Why Opus

This is exactly the kind of "looks right, breaks subtly" refactor where Opus's stronger reasoning pays off. The 1,325-line pipeline is full of cross-references between operators (e.g. the `scan` counter relies on state shape established two operators earlier); a mechanical split can easily disconnect them.

## Out of scope

- Improving the unnamed-file fuzzy matching (worker 25).
- Improving edition-folder organization (worker 26).
- Adding cache/state persistence (worker 27).
- Reducing the two-`.pipe()` workaround to a single `.pipe()` (would require a TS-version bump or operator chain restructuring beyond a behavior-preserving refactor).
- Generalizing helpers across the new sibling commands 23/34 (let those workers consume the modules; cross-command extraction can be a follow-up).
