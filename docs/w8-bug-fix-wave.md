# W8 — Bug-Fix Wave (react-migration branch)

**Status:** Ready to spawn
**Branch:** `react-migration`
**Date authored:** 2026-05-11
**Authored by:** Claude Sonnet 4.6 (orchestrator)

---

## Context

This session fixed a handful of regressions (YAML duplicate-ID deduplication, copy-button
feedback, PathField handleBrowse, Windows typeahead regex, CI lint). However several bugs
reported by the user were never fixed and are still present on `react-migration`. This
document is the self-contained brief for the next wave of workers.

---

## Universal Rules (every worker must follow)

1. **Branch:** all work on `react-migration`. No new branches unless the worker section
   says so explicitly.

2. **TDD workflow — mandatory for every bug fix:**
   - Write the test first. The test must fail before you write any fix code.
   - Commit the failing test: `test(<area>): failing test for <bug description>`
   - Write the minimum code to make the test pass.
   - Commit the fix: `fix(<area>): <description>`
   - Do not skip the failing-first step. This proves the test actually catches the bug.

3. **Pre-push gate — every push, no exceptions:**
   ```bash
   yarn test run
   yarn typecheck
   yarn lint
   ```
   If any fail, fix before pushing. Do not push broken commits.

4. **E2E gate — run before marking Done:**
   ```bash
   yarn test:e2e
   ```
   If the project has a Playwright e2e suite in `e2e/` or `packages/web/e2e/`, run it.
   If none exists yet, note it in the checklist and continue.

5. **Test rules:** No snapshot tests. No screenshot tests. Assertions must be explicit
   inline values (`expect(x).toBe("literal")` or `expect(x).toEqual({ key: "value" })`).

6. **Commit-and-push as you go.** Small logical chunks. Never batch a day's work.

7. **Update `docs/react-migration-checklist.md`** at start (🔄 In Progress) and end
   (✅ Done) of your worker section. Include one progress-log line per push.

8. **Yarn only.** Never npm or npx.

---

## Bug Inventory

| # | Area | Description | Worker |
|---|------|-------------|--------|
| B1 | DnD arrows | ↑/↓ reorder buttons have no animation (`startViewTransition` was removed to fix a stuck-overlay; that root cause is now fixed so it can be re-added) | W8A |
| B2 | DnD parallel groups | Dragging inside a parallel group highlights the group drop zone instead of slotting between items; dropping sends card to bottom | W8A |
| B3 | DnD SortableJS trial | User wants a trial branch reverting dnd-kit to SortableJS to compare behaviour | W8A |
| B13 | DnD stale collapse state | After dragging a card, clicking the global "Collapse all" button does not collapse that card — all others collapse correctly. Refreshing the page shows it as collapsed. Root cause: the dragged card's Jotai atom state becomes out of sync with its rendered output after `dragReorderAtom` runs; `setAllCollapsedAtom` may be reading a stale snapshot or the component is not re-subscribing after reorder | W8A |
| B4 | Step runner | Clicking ▶ on a single StepCard opens "Run Sequence" modal and creates an umbrella job. Should say "Run Step" and create a single individual job | W8B |
| B5 | Chevrons | "Default rules" toggle uses small Unicode `▸`/`▾`; "Predicates" uses native `<details>` disclosure triangle (larger). Both should use `CollapseChevron` SVG | W8C |
| B6 | Info panel descriptions | The ⓘ Info panel (`CommandHelpModal` → `CommandFieldEntry`) shows "No description yet — add one in src/api/schemas.ts" for every field. The `build:command-descriptions` script exists (`packages/server/scripts/build-command-descriptions.ts`) but its pre-hook `preapi-dev-server` never fires because `yarn start` uses `dev:api-server` (different name). Descriptions are stale/ungenerated | W8D |
| B7 | pathsAtom stale | Typing in a linked PathField only updates that one card. Other cards linked to the same path variable do not update until page refresh | W8E |
| B8 | PathField keyboard | TAB and Enter in the typeahead path picker do not select the highlighted item. Master had working keyboard navigation; the React port is missing it or has broken it | W8F |
| B9 | MediaInfo.exe missing | Server logs `spawn assets/mediainfo/MediaInfo.exe ENOENT` on every file scan. The `assets/` directory is empty (binary not committed). Path is hardcoded with no env-var override — users cannot point to their own MediaInfo install | W8G |
| B10 | Startup race | `yarn start` runs all 4 processes simultaneously via `concurrently`. Vite starts before Hono is ready, causing ECONNREFUSED proxy errors on the first few requests. Fix: add `wait-on` to hold Vite until port 3000 responds | W8G |
| B11 | Dry Run badge color | The "DRY RUN" badge in `PageHeader` always renders amber. When "Simulate Failures" is ON (`failureMode === true`), the badge should turn red to visually indicate the failure-simulation state | W8C |
| B12 | Missing paste/delete animations | Adding a card via InsertDivider animates (already wrapped with `startViewTransition` + `flushSync`). Pasting a card and deleting a card do not animate. The same wrapping pattern needs to be applied to the paste dispatch in `BuilderSequenceList` and the remove dispatch in `StepCard`/`GroupCard` | W8H |
| B14 | setStyleFields autocomplete | In the DSL rule builder for `setStyleFields`, the "Field" name input and the "property" input (when `computed` is checked) are plain text inputs. ASS has fixed known field sets for `[Script Info]` and `[V4+ Styles]`, so both inputs should be autocomplete dropdowns with a custom-value fallback. The "property" options must change based on the `scope` dropdown selection (`scriptInfo` vs `style`) | W8I |
| B15 | Path var deletion with in-use guard | Deleting a path variable that is referenced by one or more step fields leaves dangling `link` entries — those fields silently break (show old var name, no actual value). Master crashed with `TypeError: Cannot convert undefined or null to object` at `Object.entries` in `path-var-card.js:99` so deletion was never usable there. React version deletes cleanly but orphans the references. Fix: before deleting, scan all steps for links referencing the path var ID. If none: delete freely. If any: show a replacement prompt listing affected steps, letting user pick a substitute path var or unlink (convert links to the current literal value), then delete | W8J |

---

## Worker Assignment Table

| Worker | Bugs | Model | Thinking | Effort | Parallel with |
|--------|------|-------|----------|--------|---------------|
| W8A | B1, B2, B3, B13 | Sonnet | ON | High | alone (DnD touches many files) |
| W8B | B4 | Sonnet | ON | Medium | W8C W8D W8E W8F W8G |
| W8C | B5 B11 | Haiku | OFF | Low | W8B W8D W8E W8F W8G |
| W8D | B6 | Haiku | OFF | Low | W8B W8C W8E W8F W8G |
| W8E | B7 | Sonnet | ON | Medium | W8B W8C W8D W8F W8G |
| W8F | B8 | Sonnet | ON | Medium | W8B W8C W8D W8E W8G |
| W8G | B9, B10 | Haiku | OFF | Low | W8B W8C W8D W8E W8F W8H |
| W8H | B12 | Haiku | OFF | Low | W8B W8C W8D W8E W8F W8G W8I |
| W8I | B14 | Sonnet | ON | Medium | W8B W8C W8D W8E W8F W8G W8H W8J |
| W8J | B15 | Sonnet | ON | Medium | W8B W8C W8D W8E W8F W8G W8H W8I |

**Spawn order:**
- **Immediate (parallel):** W8B + W8C + W8D + W8E + W8F + W8G + W8H + W8I + W8J all start concurrently (touch disjoint files).
- **After user decision on DnD direction:** W8A starts once you confirm (fix dnd-kit, trial SortableJS, or both — user confirmed "both in parallel").
- **After W8A done:** W9A (interactive stories) spawns once W8A finishes and DnD is stable.

---

---

# WORKER W8A — DnD Bug Fixes + SortableJS Trial

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `react-migration` (primary) + new branch `trial/sortablejs-revert`
**Prerequisite:** User has confirmed "both in parallel"
**Parallel with:** none (DnD files touch too much)

## Your Mission

Fix four concrete dnd-kit regressions on `react-migration`, AND separately create a
`trial/sortablejs-revert` branch so the user can compare behaviour.

## Bug B1 — Arrow buttons have no animation

**Background:** `startViewTransition` + `flushSync` was removed from the ↑/↓ button
handlers in a prior session because two steps shared an `id` value (`copyBackMerged`),
causing duplicate `view-transition-name` on the page and a stuck overlay that blocked
all clicks. The duplicate-ID root cause was fixed in commit aa3a7cf (YAML loading now
deduplicates IDs). With that fixed, `startViewTransition` is safe to re-add.

**TDD steps:**
1. Write a test that mocks `document.startViewTransition` and asserts it is called when
   the ↑ or ↓ button is clicked on a StepCard or GroupCard. This test must fail first.
2. Re-add `document.startViewTransition(() => flushSync(fn))` wrapping to the `moveStep`
   and `moveGroup` dispatch calls in:
   - `packages/web/src/components/StepCard/StepCard.tsx`
   - `packages/web/src/components/GroupCard/GroupCard.tsx`
3. Add a fallback: if `document.startViewTransition` is undefined, call `fn()` directly.
4. Verify the test passes.

## Bug B2 — Parallel group drop zone swallows intra-group drags

**Background:** `useDroppable` group body zone competes with sortable item sensors during
intra-group drags. `disabled: isDraggingFromWithin` was added but the blue ring still
shows and drops resolve to bottom.

**TDD steps:**
1. Write tests in a `dragReorderAtom.test.ts` (or equivalent) that assert:
   - Intra-group drag from index 0 to index 1 reorders correctly (not appends to bottom).
   - The droppable zone `isOver` state is false when dragging a step already inside the group.
2. These tests must fail first.
3. Investigate and fix `GroupCard.tsx`:
   - Verify `isDraggingFromWithin` correctly returns `true` when any step in `group.steps`
     matches `active?.id`.
   - Verify `isOver && !isDraggingFromWithin` correctly gates the ring and background.
   - Fix `BuilderSequenceList.tsx` `onDragEnd` — when `overId` is the droppable zone id
     (`${group.id}-droppable`), resolve to the last item position, not append-to-end.
4. Verify tests pass.

## B3 — SortableJS trial branch

The project used SortableJS before. The dnd-kit migration landed in a single merge commit:
`dc11213 Merge feat/dnd-kit-migration: replace SortableJS with @dnd-kit (W6B)`.
The SortableJS implementation is preserved in git history — do NOT re-implement from scratch.

Steps:
1. Create branch `trial/sortablejs-revert` off current `react-migration`.
2. Use `git show dc11213^1` (the parent before the W6B merge) to see which files changed
   and what they looked like before.
3. Restore those files:
   ```bash
   git diff dc11213^1 dc11213 --name-only   # get the full list of changed files
   git checkout dc11213^1 -- packages/web/src/components/StepCard/StepCard.tsx
   git checkout dc11213^1 -- packages/web/src/components/GroupCard/GroupCard.tsx
   git checkout dc11213^1 -- packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx
   # and any other DnD-related files listed by the diff above
   ```
4. Run `yarn install` (restores SortableJS deps if they were removed from package.json).
5. Verify whether B1, B2, and B13 exist on this branch.
6. Run `yarn test run && yarn typecheck && yarn lint` and note pass/fail.
7. **Do NOT merge.** Push the branch and report the URL + findings to the user.

## B13 — Stale collapse state after drag-and-drop

**Symptom:** After dragging a card to a new position, clicking the global "Collapse all"
button does not collapse that card. All other cards collapse correctly. A page refresh
shows the card as collapsed — proving the atom state was updated correctly but the
component didn't re-render.

**Likely cause:** `dragReorderAtom` writes a new array to `stepsAtom` via `arrayMove`.
If the Jotai subscription for the dragged card's `step` object is not re-evaluated after
the reorder (e.g. due to reference equality or memoisation), `setAllCollapsedAtom`
updates the atom but the stale component doesn't pick up the new `isCollapsed: true`.

**TDD steps:**
1. Write a test: render two StepCards, simulate a drag reorder via `dragReorderAtom`,
   then dispatch `setAllCollapsedAtom(true)`. Assert both cards' `isCollapsed` prop is
   `true` after the collapse dispatch. This test must fail first.
2. Investigate `dragReorderAtom` in `sequenceAtoms.ts` — verify the reordered array
   contains fresh object references (not the same identity). If `arrayMove` returns
   the same object references, a Jotai atom subscriber that uses reference equality
   may not re-trigger.
3. Also check `BuilderSequenceList.tsx` — if it passes `step` as a stable object ref
   into `StepCard` and that ref is cached across the reorder, the component won't see
   the `isCollapsed` change.
4. Fix: ensure the reordered items are fresh references, or ensure `setAllCollapsedAtom`
   forces a re-render by producing new step objects.
5. Verify the test passes.

---

---

# WORKER W8B — Single Step Run Creates Sequence Job

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Parallel with:** W8C W8D W8E W8F W8G W8H W8I W8J

## Your Mission

Clicking ▶ on a single StepCard opens "Run Sequence" modal and creates an umbrella
sequence job + child job. The user expects "Run Step" with a single individual job.

## Root cause (confirmed)

`runOrStopStepAtom` in `packages/web/src/state/sequenceAtoms.ts`:
- Correctly serializes only `[step]` to YAML (line ~567)
- Opens `apiRunModalAtom` — which shows the "Run Sequence" modal title
- Posts to `/sequences/run` — which creates umbrella + child on the server

## TDD steps

1. Write a test that asserts: when `runOrStopStepAtom` is dispatched with a single step
   ID, `apiRunModalAtom` is set with `source: "step"`. This test must fail first.
2. Add a `source: "step" | "sequence"` field to the `apiRunModalAtom` state type
   in `packages/web/src/state/uiAtoms.ts`.
3. In `runOrStopStepAtom`, set `source: "step"` when opening the modal.
4. In the full-sequence run path (`runViaApi` in `useBuilderActions.ts`), set
   `source: "sequence"`.
5. In the `ApiRunModal` component, render "Run Step" when `source === "step"`, and
   "Run Sequence" when `source === "sequence"`.
6. Write a second test: modal renders "Run Step" title when `source === "step"`.
7. Verify both tests pass.

## Files

- `packages/web/src/state/sequenceAtoms.ts` — `runOrStopStepAtom`
- `packages/web/src/state/uiAtoms.ts` — `apiRunModalAtom` type
- `packages/web/src/hooks/useBuilderActions.ts` — `runViaApi`
- The `ApiRunModal` component (find via grep for `apiRunModalAtom`)

---

---

# WORKER W8C — Unify Collapse Chevrons + Dry Run Badge Color

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `react-migration`
**Parallel with:** W8B W8D W8E W8F W8G W8H W8I W8J

## Your Mission

Two collapsible sections use different triangle glyphs at different sizes. Both should
use the `CollapseChevron` SVG icon component. Also fix the Dry Run badge color.

## Bug B5

| Location | Current chevron | Problem |
|----------|-----------------|---------|
| `SubtitleRulesField.tsx` "Default rules" button | Unicode `▸` / `▾` in `text-xs` button | Visually smaller than Predicates |
| `PredicatesManager.tsx` "Predicates" section | Native `<details>` / `<summary>` UA triangle | Larger than Default rules, inconsistent |

## Reuse

`packages/web/src/icons/CollapseChevron/CollapseChevron.tsx`
- Props: `{ isCollapsed: boolean }`
- Renders `w-3.5 h-3.5` SVG, rotates `-rotate-90` when collapsed
- Already used in `StepCard.tsx` and `GroupCard.tsx`

## Bug B11 — Dry Run badge color

The "DRY RUN" badge in `PageHeader` always renders amber even when Simulate Failures is ON.

## TDD steps

1. Write tests that assert:
   - Clicking "Default rules" toggle renders `<svg>` with `-rotate-90` class when collapsed,
     and without when expanded.
   - Clicking "Predicates" button renders `<svg>` with same class pattern.
   - When `failureMode` is true, the "DRY RUN" badge has a red class (e.g. `text-red-400`).
   - When `failureMode` is false, the badge has an amber class (e.g. `text-amber-400`).
   These tests must fail first.
2. **`SubtitleRulesField.tsx`:** import `CollapseChevron`; replace `{isPreviewOpen ? "▾" : "▸"}`
   with `<CollapseChevron isCollapsed={!isPreviewOpen} />`.
3. **`PredicatesManager.tsx`:** import `CollapseChevron`; replace the `<details>`/`<summary>`
   element with a plain `<button>` + `<CollapseChevron isCollapsed={!isOpen} />`. The
   existing `isOpen` state is already present — no new state needed. Wire the `onClick`
   to `() => setIsOpen((prev) => !prev)`. Render children with `{isOpen && <div>...</div>}`.
4. **`PageHeader.tsx`:** the "DRY RUN" badge already reads `failureMode` from
   `useAtom(failureModeAtom)`. Change the badge's className to use red when
   `failureMode === true`, amber otherwise. Example:
   ```tsx
   className={`... ${failureMode
     ? "bg-red-500/20 hover:bg-red-500/35 text-red-400 border-red-500/40"
     : "bg-amber-500/20 hover:bg-amber-500/35 text-amber-400 border-amber-500/40"
   }`}
   ```
   Also update the `title` attribute: `"Dry run ON (failure mode) — click to disable"` vs
   `"Dry run ON — click to disable"`.
5. Verify all tests pass.

---

---

# WORKER W8D — Info Panel Field Descriptions

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8E W8F W8G W8H W8I W8J

## Your Mission

The ⓘ Info panel (`CommandHelpModal` → `CommandFieldEntry.tsx`) shows
"No description yet — add one in src/api/schemas.ts" for every field.
Field tooltips (hover labels) work fine — only the Info panel is broken.

## Root cause (already confirmed)

- Build script: `packages/server/scripts/build-command-descriptions.ts`
- Root `package.json` defines `"preapi-dev-server": "yarn build:command-descriptions"`
- But `yarn start` calls `dev:api-server` (not `api-dev-server`), so the pre-hook name
  never matches and descriptions are never generated in dev.

## TDD steps

1. Write a test asserting the generated descriptions output file is non-empty and
   contains at least one field description string. This test must fail first.
2. Run the script manually:
   ```bash
   yarn build:command-descriptions
   ```
3. Identify the output file it writes. Commit it.
4. Fix the pre-hook so it fires on `yarn start`. In root `package.json` add:
   ```json
   "predev:api-server": "yarn build:command-descriptions"
   ```
   (Keep the existing `preapi-dev-server` in case other callers use it.)
5. Verify the test passes and the Info panel shows real descriptions after a fresh start.

## Files

- `packages/server/scripts/build-command-descriptions.ts` — the generator
- `package.json` (root) — add `predev:api-server` hook
- Generated output file (determine from running the script)

---

---

# WORKER W8E — pathsAtom Stale State on Linked PathField

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8F W8G W8H W8I W8J

## Your Mission

Typing in a linked PathField only updates that one card. Other cards sharing the same
path variable do not update until a full page refresh.

## TDD steps

1. Write a test that:
   - Renders two `PathField` components in the same Jotai `Provider` both linked to
     the same path variable (e.g. `basePath`).
   - Simulates typing a new value in the first field.
   - Asserts the second field's `value` attribute also reflects the new value immediately
     (without any re-render or refresh trick).
   This test must fail first.
2. Investigate the atom chain:
   - `PathField.tsx` `onChange` → `setPathValue(link, value)` (when `typeof link === "string"`)
   - `pathsAtom.ts` — `setPathValueAtom` write: does it correctly mutate `pathsAtom`?
   - `PathField.tsx` `displayValue` → `getLinkedValue(step, field.name, paths, ...)` where
     `paths = useAtomValue(pathsAtom)` — does this subscription re-render on atom change?
3. Fix the broken link in the atom chain.
4. Verify the test passes.

## Files

- `packages/web/src/components/PathField/PathField.tsx`
- `packages/web/src/state/pathsAtom.ts`
- `packages/web/src/commands/links.ts` — `getLinkedValue`

---

---

# WORKER W8F — PathField Typeahead Keyboard Navigation Broken

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8E W8G W8H W8I W8J

## Your Mission

In the PathField typeahead dropdown (the autocomplete that shows filesystem suggestions
as you type a path), TAB and Enter do not select the highlighted item. The user reports
this worked on master. The React port is missing or has broken the keyboard handlers.

## Background

- The typeahead dropdown is rendered by `PathPicker` (the picker that opens below the
  path input when you type a path starting with `/` or a drive letter like `C:\`).
- On master, TAB or Enter while an item is highlighted in the dropdown would accept
  that item into the input and close the dropdown.
- On `react-migration`, neither key has any effect on the dropdown — the input does not
  update and the dropdown stays open.

## TDD steps

1. Find the `PathPicker` component and its keyboard event handling (search for
   `PathPicker`, `pathPickerState`, `onKeyDown` in `packages/web/src/`).
2. Write tests that assert:
   - Pressing Enter while the picker is open and `activeIndex` points to an item calls
     the appropriate setter with that item's path value.
   - Pressing TAB while the picker is open does the same.
   - Pressing Escape closes the picker without selecting.
   These tests must fail first.
3. Compare with master's vanilla JS implementation (look in
   `packages/web/public/builder/js/` for the original path picker keyboard logic).
4. Port any missing keyboard handling into the React component.
5. Verify tests pass.

## Files to check

- `packages/web/src/state/pickerAtoms.ts` — `pathPickerStateAtom`
- The `PathPicker` component directory (search: `grep -r "pathPickerState" src/`)
- `packages/web/public/builder/js/` — master's original implementation for reference

---

---

# WORKER W8G — MediaInfo.exe Path Configuration + Startup Race

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8E W8F W8H W8I W8J

## Your Mission

Fix two server-startup issues: MediaInfo binary path is hardcoded with no env-var
override, and `yarn start` has a race condition where Vite starts before Hono is ready.

## Bug B9 — MediaInfo.exe hardcoded path

The server logs `spawn assets/mediainfo/MediaInfo.exe ENOENT` on every file scan because
the `assets/` directory is empty — the binary was never committed (correct: binaries
don't belong in git). There is no env-var override, so users cannot point to their own
MediaInfo installation without editing source code.

`packages/server/src/tools/appPaths.ts` line ~15:
```ts
export const mediaInfoPath = isWindows
  ? "assets/mediainfo/MediaInfo.exe"
  : "mediainfo"
```

**TDD steps:**
1. Write a test that asserts `mediaInfoPath` equals `process.env.MEDIAINFO_PATH` when
   that env var is set to a custom value. This test must fail first.
2. Update `appPaths.ts` to:
   ```ts
   export const mediaInfoPath =
     process.env["MEDIAINFO_PATH"] ??
     (isWindows ? "assets/mediainfo/MediaInfo.exe" : "mediainfo")
   ```
3. Update `.env.example` to document the new variable:
   ```
   # Path to the MediaInfo CLI binary.
   # Windows default: assets/mediainfo/MediaInfo.exe (place MediaInfo.exe there, or override here)
   # Linux/Mac default: mediainfo (must be in PATH)
   # MEDIAINFO_PATH=C:\Program Files\MediaInfo\MediaInfo.exe
   ```
4. Verify the test passes.

## Bug B10 — Startup race condition

`yarn start` runs all 4 processes simultaneously via `concurrently --kill-others`.
Vite starts before Hono is ready, causing ECONNREFUSED proxy errors on the first few
requests (observed on `/jobs/stream` SSE endpoint).

**TDD steps:**
1. There is no unit test for process startup order — document this in the checklist
   and proceed directly to the fix.
2. Add `wait-on` as a dev dependency:
   ```bash
   yarn add -D wait-on
   ```
3. In root `package.json`, split the `start` script so the Vite process waits for
   port 3000:
   ```json
   "start:web": "wait-on tcp:3000 && yarn workspace @media-tools/web dev",
   "start": "concurrently --kill-others \"yarn start:api\" \"yarn start:web\""
   ```
   (Adjust script names to match what currently exists — read `package.json` first.)
4. Verify `yarn start` no longer logs ECONNREFUSED on startup.

## Files

- `packages/server/src/tools/appPaths.ts`
- `.env.example` (repo root)
- `package.json` (root) — split start script to add `wait-on`

---

---

# WORKER W8H — Paste and Delete Card Animations

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8E W8F W8G W8I W8J

## Your Mission

Adding a card via InsertDivider already animates (wrapped with
`startViewTransition(() => flushSync(fn))` in `BuilderSequenceList.tsx`).
Pasting and deleting cards do not animate — the list jumps immediately.

## Root cause

The `pasteCardAt` dispatch and the `removeStep`/`removeGroup` dispatches are called
directly without a View Transitions wrapper. They need the same pattern:

```ts
if (document.startViewTransition) {
  document.startViewTransition(() => { flushSync(() => dispatch(action)) })
} else {
  dispatch(action)
}
```

## Where to apply

- **Paste** — `pasteCardAt` is called from `GroupCard.tsx` and `BuilderSequenceList.tsx`
  (the "📋 Paste" button and InsertDivider paste variant). Wrap those call sites.
- **Delete step** — `removeStep` is dispatched from the ✕ button in `StepCard.tsx`.
- **Delete group** — `removeGroup` is dispatched from the ✕ button in `GroupCard.tsx`.

## TDD steps

1. Write tests asserting `document.startViewTransition` is called when:
   - The ✕ delete button is clicked on a StepCard
   - The ✕ delete button is clicked on a GroupCard
   - The "📋 Paste" button is clicked
   These tests must fail first.
2. Add the `startViewTransition` + `flushSync` wrapper at each call site listed above.
   Import `flushSync` from `react-dom` where not already imported.
3. Verify tests pass.

## Files

- `packages/web/src/components/StepCard/StepCard.tsx`
- `packages/web/src/components/GroupCard/GroupCard.tsx`
- `packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx`
  (verify paste call sites — may already wrap insert but not paste)

---

---

# WORKER W8I — setStyleFields Autocomplete Dropdowns

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8E W8F W8G W8H W8J

## Your Mission

In the DSL rule builder for the `setStyleFields` command, two plain text inputs should
become autocomplete dropdowns with a custom-value fallback:

1. **"Field" name input** — the ASS style field being set (e.g. `Fontname`, `Fontsize`,
   `PrimaryColour`). Valid values are the fixed `[V4+ Styles]` column names from the ASS
   specification.
2. **"property" input** (shown when `computed` is checked) — the metadata property to
   read the value from. Valid values depend on the `scope` dropdown:
   - `scope: scriptInfo` → `[Script Info]` known keys
   - `scope: style` → `[V4+ Styles]` known field names (same set as #1)

Both inputs must still allow custom/arbitrary values that aren't in the list.

## Known ASS field sets

Define these as constants in a new file
`packages/web/src/components/DslRulesBuilder/assFields.ts`:

```ts
// ASS [Script Info] known keys
export const SCRIPT_INFO_FIELDS = [
  "Title", "ScriptType", "WrapStyle", "PlayResX", "PlayResY",
  "ScaledBorderAndShadow", "YCbCr Matrix", "LastStyleStorage",
  "Video File", "Video Aspect Ratio", "Video Zoom", "Video Position",
] as const

// ASS [V4+ Styles] column names
export const STYLE_FIELDS = [
  "Name", "Fontname", "Fontsize",
  "PrimaryColour", "SecondaryColour", "OutlineColour", "BackColour",
  "Bold", "Italic", "Underline", "StrikeOut",
  "ScaleX", "ScaleY", "Spacing", "Angle",
  "BorderStyle", "Outline", "Shadow", "Alignment",
  "MarginL", "MarginR", "MarginV", "Encoding",
] as const
```

## UI pattern — use the existing EnumField / EnumPicker

**Do NOT use native `<datalist>`.** The project already has `EnumField` + `EnumPicker`
which provides a searchable/filterable dropdown with keyboard navigation. Reuse that.

Read these files first to understand the pattern:
- `packages/web/src/components/EnumField/EnumField.tsx` — the trigger button
- `packages/web/src/components/EnumPicker/EnumPicker.tsx` — the portal dropdown
- `packages/web/src/state/pickerAtoms.ts` — `enumPickerStateAtom`

The "Field" and "property" inputs should become `EnumField`-style trigger buttons that
open `EnumPicker` with the appropriate options list. Since `EnumPicker` is driven by a
Jotai atom (`enumPickerStateAtom`) and currently reads options from the step's command
field definition, you will need to either:
- **Option A:** Pass the `assFields` options list directly to an `enumPickerStateAtom`
  write that accepts a static options array (extend the atom if needed), OR
- **Option B:** Render a self-contained local dropdown (not portal-based) that reuses
  the same visual style as `EnumPicker` but is driven by local state.

Read `EnumField.tsx` and `EnumPicker.tsx` fully before deciding. Choose whichever
requires fewer changes while staying visually consistent.

Both fields must still allow typing a custom value not in the list.

## TDD steps

1. Write tests asserting:
   - Clicking the "Field" trigger opens a picker showing `"Fontname"` as an option.
   - Clicking the "property" trigger with `scope="scriptInfo"` shows `"PlayResY"`.
   - Clicking the "property" trigger with `scope="style"` shows `"PrimaryColour"` instead.
   - Selecting an option updates the field value.
   - Typing a custom value not in the list still saves correctly.
   These tests must fail first.
2. Create `assFields.ts` with the two constant arrays.
3. Update the `setStyleFields` rule component to use `EnumField`/`EnumPicker` (or a
   local variant) for both the "Field" and "property" inputs.
4. Verify tests pass.

## Files

- `packages/web/src/components/DslRulesBuilder/assFields.ts` (new)
- `packages/web/src/components/EnumField/EnumField.tsx` (read for pattern)
- `packages/web/src/components/EnumPicker/EnumPicker.tsx` (read for pattern)
- The `setStyleFields` rule component in `packages/web/src/components/DslRulesBuilder/`
  (find via grep for `setStyleFields` in that directory)

---

---

# WORKER W8J — Path Variable Deletion with In-Use Guard

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8E W8F W8G W8H W8I

## Your Mission

Deleting a path variable that is still referenced by step fields orphans those fields —
they show the old variable name but have no value. The old master JS code crashed
entirely on deletion (`Object.entries(null)` in `path-var-card.js:99`), so deletion
was never usable there. The React version deletes cleanly but leaves dangling `link`
references. Fix this properly.

## Desired behaviour

1. **No references:** Delete immediately, no prompt.
2. **Has references:** Before deleting, open a compact inline prompt (no full modal needed)
   showing which steps and fields use this path var, with two choices per field:
   - **Replace with:** a dropdown of remaining path vars to swap to
   - **Unlink:** remove the link and convert the field to a literal value using the
     current path var's value string
3. User confirms → apply all replacements/unlinks atomically → delete the path var.
4. User cancels → path var stays, nothing changes.

## Implementation notes

- The scan for usages lives naturally in `pathsAtom.ts` or a new `removePathVarAtom`
  write handler. Use `flattenSteps` (already exists) to walk all steps including
  those inside groups.
- A step field references a path var when `step.links[fieldName] === pathVarId`
  (string link, not object link).
- "Replace with" swaps `step.links[fieldName]` to the new path var ID.
- "Unlink" deletes `step.links[fieldName]` and sets `step.params[fieldName]` to the
  current path var value string.
- The UI prompt can live inline in `PathVarCard.tsx` as a conditional block — no new
  modal atom needed.

## TDD steps

1. Write tests asserting:
   - Dispatching `removePathVarAtom` with an unused path var ID deletes it immediately.
   - Dispatching with an in-use ID does NOT delete it but instead sets a `pendingDelete`
     state listing the affected fields.
   - Choosing "Replace with" swaps all `link` references to the new ID.
   - Choosing "Unlink" removes the links and writes the literal value to `params`.
   - After confirming, the path var is removed from `pathsAtom`.
   These tests must fail first.
2. Extend `removePathVarAtom` (or create a two-phase version) to detect usages.
3. Add the inline confirmation UI to `PathVarCard.tsx`.
4. Verify tests pass.

## Files

- `packages/web/src/state/pathsAtom.ts` — `removePathVarAtom`
- `packages/web/src/components/PathVarCard/PathVarCard.tsx` — inline prompt UI
- `packages/web/src/jobs/sequenceUtils.ts` — `flattenSteps` (reuse for scan)

---

---

# PHASE W9 — Interactive Storybook Stories (depends on W8A)

---

# WORKER W9A — Interactive StepCard + GroupCard Stories

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Prerequisite:** W8A (DnD fixes + SortableJS decision) completed
**Parallel with:** none

## Your Mission

Add comprehensive interactive Storybook stories for `StepCard` and `GroupCard` that:
1. Use real Jotai atoms (`commandsAtom`, `stepsAtom`, `pathsAtom`, `sequenceAtoms`)
2. Wire up real `useBuilderActions` hooks (run, copy, move, delete, etc.)
3. Render full dnd-kit context so drag-and-drop actually works
4. Test the component at feature-level, not just visually

Stories should include examples of:
- A step with `keepLanguages` command (LanguageCodesField)
- A step with `copyFiles` command (PathField + NumericField)
- A step with `modifySubtitleMetadata` command with rules (SubtitleRulesField)
- A blank step (no command selected)
- A step in different states (idle, running, success, error)
- A parallel group with multiple steps
- A serial group with multiple steps

## TDD steps

1. Create `packages/web/src/components/StepCard/StepCard.interactive.stories.tsx`:
   - Wrap stories in a custom `InteractiveStoryProvider` that:
     - Sets up a real Jotai Provider
     - Populates `commandsAtom` with `FIXTURE_COMMANDS_BUNDLE_D`
     - Populates `stepsAtom` with example steps (keepLanguages, copyFiles, applyRules)
     - Wraps everything in dnd-kit `DndContext`, `DragOverlay`, `SortableContext`
   - Add one story per interesting command variation
   - Each story should allow:
     - Dragging to reorder (dnd-kit will work)
     - Clicking ↑/↓ to move
     - Clicking run/stop (calls `runOrStopStep`)
     - Clicking copy (calls `copyStepYaml`)
     - Clicking ✕ to delete (calls `removeStep`)
     - Expanding/collapsing to see fields
     - Editing field values and seeing them update in real-time
2. Create similar `GroupCard.interactive.stories.tsx` with:
   - A parallel group with 2-3 steps
   - A serial group with 3-4 steps
   - Ability to drag steps between groups
   - Ability to collapse/expand inner steps
3. Write tests asserting:
   - The interactive story renders without errors
   - Jotai atoms are wired correctly (dragging triggers `dragReorderAtom`)
   - `useBuilderActions` hooks fire correctly on button click (not comprehensive — just smoke tests)
4. Verify all tests pass.

## Rationale

Currently, Storybook stories show cards in isolation with mock props. Users can see the UI
but cannot interact with it or verify that drag, run, copy, delete, etc. actually work.

Interactive stories use the **exact same Jotai atoms and hooks as the Builder page**, so
they verify feature-level correctness at the component level. This is a bridge between
unit tests (which mock everything) and the full Builder page (which is hard to automate).

## Files to create / modify

- `packages/web/src/components/StepCard/StepCard.interactive.stories.tsx` (new)
- `packages/web/src/components/GroupCard/GroupCard.interactive.stories.tsx` (new)
- `packages/web/src/components/StepCard/StepCard.test.tsx` (add smoke tests for interactive story)
- `packages/web/src/components/GroupCard/GroupCard.test.tsx` (add smoke tests)

---

## Verification checklist (all workers)

Before marking Done:

- [ ] Failing test committed before fix code
- [ ] `yarn test run` — all tests pass
- [ ] `yarn typecheck` — clean
- [ ] `yarn lint` — clean
- [ ] `yarn test:e2e` — passes (or noted in checklist if suite absent)
- [ ] New tests cover the exact regression scenario
- [ ] Checklist row updated to ✅ Done in `docs/react-migration-checklist.md`
- [ ] Pushed to `origin/react-migration`
