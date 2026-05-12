# Worker 0f — undo-redo-scroll-to-affected

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/0f-undo-redo-scroll-to-affected`
**Worktree:** `.claude/worktrees/0f_undo-redo-scroll-to-affected/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

When the user hits Undo or Redo, the affected card/step should scroll into view. Today, the state changes but the user has to scroll to find what changed — sometimes the change is offscreen.

### Implementation outline

1. The undo/redo state lives in [packages/web/src/state/historyAtoms.ts](../../packages/web/src/state/historyAtoms.ts) (verify). Each snapshot is a YAML string.
2. When undo/redo is dispatched, diff the current state against the new state to identify which step(s) changed. Options for diff:
   - Compare YAML strings line-by-line (cheap, but coarse).
   - Diff at the step-id level: which step IDs added/removed/changed?
3. After applying the undo/redo, scroll the first changed step's DOM node into view via `element.scrollIntoView({ behavior: "smooth", block: "center" })`.
4. The scroll happens AFTER the DOM updates — wait one tick (e.g., `requestAnimationFrame` or `useLayoutEffect` + `setTimeout(0)`).

### Edge cases

- Undo/redo restores to an EMPTY state (no steps): no scroll, just stay at top.
- Multiple steps changed: scroll to the FIRST changed step (in document order).
- The affected step is in a collapsed parent group: expand the group before scrolling (or scroll to the group itself).

### Tests

- Render a sequence with 10 steps; delete step 7; undo; assert step 7's DOM node received `scrollIntoView`.
- Mock `scrollIntoView` to spy on the call.

## TDD steps

1. Write failing test as above. Commit.
2. Implement diffing in the undo/redo dispatch.
3. Wire `scrollIntoView` call.
4. Verify test passes.
5. E2E sanity-check: undo/redo flow still works.

## Files

- [packages/web/src/state/historyAtoms.ts](../../packages/web/src/state/historyAtoms.ts) (verify)
- [packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx](../../packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx) (the rendered list — likely owns the scroll-target refs)
- Possibly a new `useScrollToAffectedStep.ts` hook to encapsulate the scroll logic
- Tests for the above

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing test first
- [ ] Diff identifies changed step(s)
- [ ] `scrollIntoView` fires on the right element
- [ ] Empty-state edge case handled
- [ ] Collapsed-group edge case handled (expand-before-scroll)
- [ ] `prefers-reduced-motion: reduce` → use `behavior: "auto"` instead of `"smooth"`
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Visual highlight of the affected step (e.g., flashing border) — could be a follow-up
- Undo/redo for non-sequence state (e.g., path variables)
- Refactoring the undo/redo stack representation
