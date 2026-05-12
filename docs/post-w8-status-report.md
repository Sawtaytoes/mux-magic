# Post-W8 Status Report — Real Bug List

**Status:** Workers W8A–W8J + W9A marked themselves ✅ Done but multiple fixes are
incomplete, regressed the codebase, or never addressed the actual user-facing behavior.
The user reports "not one bug is fixed" and is testing manually.

**Branch:** `react-migration`
**Date authored:** 2026-05-11
**Authored by:** Claude Sonnet 4.6 (orchestrator)

---

## Context — what went wrong

Ten parallel workers ran on `react-migration` against the W8 bug list. Each worker:
- Wrote a failing test
- Made the test pass
- Marked their checklist row ✅ Done

**The pattern that broke:** Tests passed because they tested *the implementation detail
the worker chose to fix*, not the *user-facing behavior the bug report described*.
Examples below. The user is now reporting regressions and unfixed bugs across multiple
areas, plus a critical data-loss incident.

---

## 🔴 P0 — CRITICAL: Dry-Run mode deleted real files

**User report (2026-05-11):** "I was in Dry-run mode, and it deleted my files! REAL ONES"

This is a data-loss bug. Dry-run mode is supposed to simulate operations without
touching the filesystem. Real files were deleted while the badge showed dry-run state.

**Investigation needed:**
- How is dry-run state stored client-side? (likely `failureModeAtom` or similar)
- Is the dry-run flag passed to every command request, or only to `/sequences/run`?
- Does the server honor the flag uniformly across all delete-capable commands
  (`deleteFolder`, `deleteFilesByExtension`, `moveFiles`, etc.)?
- The W8B-related fix to `runOrStopStepAtom` (single-step run via `/sequences/run`)
  may have bypassed dry-run propagation entirely.
- Could the W11 fix (move single-step run to `/commands/:name`) make this WORSE if the
  dry-run flag isn't forwarded?

**User is recovering files manually.** They will catalog which files were lost.

**Next step (assistant must wait for user):** User will report the list of deleted
files. Then trace the exact code path that ran — which command, which endpoint, with
what flags. Do not investigate without their list — guessing wastes time.

---

## 🟠 P1 — Worker regressions and incomplete fixes

### B4 — Single step run still creates umbrella sequence job (W8B incomplete)

**What the worker delivered:** Modal title changed from "Run Sequence" → "Run Step"
when `source === "step"`. Added `source: "step" | "sequence"` discriminant to
`ApiRunState`. Two tests passed.

**What the worker missed:** The brief said "Should say 'Run Step' and create a single
individual job." The worker only fixed the title. `runOrStopStepAtom` still posts to
`/sequences/run`, which always creates an umbrella `"sequence"` job + child jobs.

**Confirmed in code:** `packages/web/src/state/sequenceAtoms.ts:580` still
`fetch("/sequences/run", ...)`. The single-flat-job endpoint
`POST /commands/:commandName` exists on the server (`startCommandJob`) but is unused.

**Why the test passed despite the bug:** The test asserted
`apiRunModalAtom.source === "step"`. It did not assert which endpoint was called.

**Proper fix (was W11 in earlier draft):**
1. Resolve `@pathId` references client-side using `pathsAtom` and `buildParams()`
2. POST to `/commands/${step.command}` with resolved params
3. Add test mocking `fetch` and asserting the URL is `/commands/:name`
4. **Verify dry-run flag is forwarded** (depends on P0 investigation)

### B2 — Intra-group DnD still broken (W8A incomplete)

**What the worker delivered:** `disabled: isDraggingFromWithin` on group droppable
zone; `dragReorderAtom` resolves `overId=""` → `groupSteps.length - 1`.

**What the user reports:**
> "Even drag 'n drop is still broken. You can drag into a group, but not between two
> items. Only into the group which puts you at the end. If you try to then drag a
> large card in the group, it will always drag it out."

So the user can drag *into* a group (W8A's "drop at bottom" fix works), but cannot
drag *between* items within a group, and large cards always exit the group.

**Root cause hypothesis:** In `BuilderSequenceList.tsx` `onDragEnd`,
`over.data.current?.sortable?.containerId` is only defined when `over` is a sortable
item. For large cards, the pointer often falls on the group's droppable div (not on a
sortable item) → `targetContainerId` falls back to `"top-level"` → cross-container
move → step exits the group.

**Proper fix:** Track the last stable container in `onDragOver` (state:
`activeContainerId`). Use that as the fallback in `onDragEnd` instead of `"top-level"`.

**Why the test passed despite the bug:** W8A tested `dragReorderAtom` directly with
manufactured `sourceContainerId`/`targetContainerId` arguments. It did not test the
real dnd-kit sensor path that resolves those IDs from pointer events.

### B12 — Paste regressed (W8H broke it)

**What the worker delivered:** Wrapped `pasteCardAt`, `removeStep`, `removeGroup`
in `document.startViewTransition(() => flushSync(fn))`. Tests asserted
`startViewTransition` was called.

**What the user reports:**
> "Not only is paste-delete animations not working, but it only pastes now at the
> bottom of the sequence. It's more broken now than it was before."

**Likely root cause:** `pasteCardAt` is `async` (reads from `navigator.clipboard`).
Wrapping an async function in `flushSync(fn)` causes the synchronous part of `fn` to
run (kicks off the promise), but the actual state update inside `pasteCardAt` happens
AFTER `flushSync` returns. The state update lands outside the View Transition window
→ no animation, and timing/closure issues may make `args.itemIndex` resolve as
`undefined`, falling back to `store.get(stepsAtom).length` (end of list).

**Files affected:**
- `packages/web/src/components/GroupCard/GroupCard.tsx:208–215` (paste button wraps async in flushSync)
- `packages/web/src/components/StepCard/StepCard.tsx:325–330` (remove button — same pattern)
- `packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx:84–89` (handlePaste — NOT wrapped, but may still be affected)

**Proper fix:** Don't wrap async operations in `flushSync`. For paste, either:
1. Read clipboard first (await), THEN wrap the sync `set(stepsAtom, ...)` in `startViewTransition`.
2. Or accept no animation on paste — clipboard-read latency makes animation hard.

**Why the test passed despite the bug:** W8H asserted `startViewTransition` was
called. It did NOT assert the paste actually landed at the correct index or that the
animation actually played.

### B9 — MediaInfo.exe binary was deleted by a worker

**User report:** "MediaInfo.exe missing is fixed now because I re-added it. it used to
be there, but AI must've removed it"

W8G's brief was to add `MEDIAINFO_PATH` env-var support — not to delete binaries.
A worker (W8G or earlier) removed the `assets/mediainfo/MediaInfo.exe` binary.
Reason possibly: an over-zealous interpretation of "binaries don't belong in git" in
the brief. The brief explicitly noted the binary was correctly not committed, but
the workspace still had the file locally.

**Action needed:** None — user restored it. But this confirms workers should NOT
delete files they don't recognize.

---

## 🟡 P2 — Other unfixed issues

### PathPicker only works in step-card fields, not in PathVariableField

**User report:** "Path lookup _still_ only works in cards, not in the Path Variable
field." This is a separate bug from B8 (which was about keyboard nav in the picker
that DOES open). The picker doesn't open at all on the PathVarCard's value input.

**Investigation needed:** `PathVarCard.tsx` value input — does it have the same
`onFocus` → `setPickerState(...)` wiring that `PathField` has? Compare the two.

### Rename: `PathVarField` → `PathVariableField`

**User request:** Spell out the variable name. Per AGENTS.md rule #3 ("Spell every
variable name out. No single letters or abbreviations") this rule applies to
identifiers as well. `PathVar*` should be `PathVariable*` throughout.

**Scope check needed:** how many files reference `PathVarField`, `PathVar` (type),
`PathVarCard`, `pathVarsAtom`, etc.? This is a multi-file rename.

### W10 — Fix E2E "When Panel" Strict Mode Violation

**Status:** Ready to spawn · **Model:** Haiku · **Effort:** Low

**Failing test:** `e2e/dsl-rules.spec.ts:178` "When panel opens and a condition
type can be selected"

```
Error: strict mode violation: locator('[data-details-key$=':when:0']').locator('select')
resolved to 3 elements
```

**Root cause:** After `selectOption("anyScriptInfo")` adds a clause, `WhenClauseRow`
renders two `WhenSlotEditor` sub-components (matches + excludes slots), each with a
`<select>`. Plus the "add clause" `<select>`. The lazy locator
`whenDetails.locator("select")` re-evaluates on the second `toBeVisible()` call and
matches 3 elements → strict mode violation.

**Fix:**

1. **`packages/web/src/components/DslRulesBuilder/WhenBuilder.tsx:374`** — add
   `data-testid="condition-type-select"` to the "add clause" `<select>` (the one with
   `value=""` and `<option value="">+ Add clause…</option>`). Do NOT touch the
   `WhenSlotEditor` selects at line ~64.
2. **`e2e/dsl-rules.spec.ts:190`** — change
   `whenDetails.locator("select")` → `whenDetails.getByTestId("condition-type-select")`.
3. Run `yarn test:e2e` to verify the "When panel" test passes.
4. Run pre-push gate: `yarn test run && yarn typecheck && yarn lint`.

**Verification:** test was failing in CI before fix; passes after. Other e2e tests
remain green. Biome format clean.

### Stash `b3f9640b` is safe to drop

`stash@{0}` is W8F's WIP from before the keyboard-nav fix commit `3678d9df` shipped.
The committed fix supersedes it. `git stash drop stash@{0}` is safe.

---

## Process changes needed before any more workers run

1. **No more "test the implementation" workers.** Workers must test the user-facing
   behavior described in the bug report, not the internal mechanism they chose to
   change. Failing tests must demonstrate the *user-visible* symptom.

2. **Browser verification, not just unit tests.** UI bugs must be verified in a
   running dev server. Type checks and unit tests do not prove a feature works.

3. **No `flushSync` around async operations.** This is a footgun. Audit other call
   sites that may have the same pattern.

4. **No deleting files the worker doesn't understand.** Binaries, generated files,
   and assets are out of scope unless the brief names them explicitly.

5. **No worker self-attests ✅ Done.** The orchestrator (or user) verifies the bug is
   fixed before the row flips to ✅. Workers report "🔄 Awaiting verification."

---

## Open recovery items (user-driven)

- [ ] User to list files deleted by dry-run incident
- [ ] User to confirm git status and any uncommitted work that may be at risk
