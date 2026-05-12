# WORKER W9A — Interactive StepCard + GroupCard Stories

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Prerequisite:** W8A (DnD fixes + SortableJS decision) must be complete before spawning this worker
**Parallel with:** none

---

## Universal Rules

1. **Branch:** all work on `react-migration`. No new branches.

2. **TDD workflow — mandatory:**
   - Write the test first. The test must fail before you write any fix code.
   - Commit the failing test: `test(<area>): failing test for <description>`
   - Write the minimum code to make the test pass.
   - Commit the implementation: `feat(<area>): <description>`
   - Do not skip the failing-first step.

3. **Pre-push gate — every push, no exceptions:**
   ```bash
   yarn test run
   yarn typecheck
   yarn lint
   ```

4. **E2E gate — run before marking Done:**
   ```bash
   yarn test:e2e
   ```
   If no e2e suite exists yet, note it in the checklist and continue.

5. **Test rules:** No snapshot tests. No screenshot tests. Assertions must be explicit
   inline values (`expect(x).toBe("literal")` or `expect(x).toEqual({ key: "value" })`).

6. **Commit-and-push as you go.** Small logical chunks.

7. **Update `docs/react-migration-checklist.md`** at start (🔄 In Progress) and end
   (✅ Done) of your worker section. Include one progress-log line per push.

8. **Yarn only.** Never npm or npx.

---

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

## Rationale

Currently, Storybook stories show cards in isolation with mock props. Users can see the
UI but cannot interact with it or verify that drag, run, copy, delete, etc. actually work.

Interactive stories use the **exact same Jotai atoms and hooks as the Builder page**, so
they verify feature-level correctness at the component level. This is a bridge between
unit tests (which mock everything) and the full Builder page (which is hard to automate).

## Implementation steps

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
2. Create `packages/web/src/components/GroupCard/GroupCard.interactive.stories.tsx`:
   - A parallel group with 2-3 steps
   - A serial group with 3-4 steps
   - Ability to drag steps between groups
   - Ability to collapse/expand inner steps
3. Write tests asserting:
   - The interactive story renders without errors
   - Jotai atoms are wired correctly (dragging triggers `dragReorderAtom`)
   - `useBuilderActions` hooks fire correctly on button click (smoke tests only)
4. Verify all tests pass.

## Files to create / modify

- `packages/web/src/components/StepCard/StepCard.interactive.stories.tsx` (new)
- `packages/web/src/components/GroupCard/GroupCard.interactive.stories.tsx` (new)
- `packages/web/src/components/StepCard/StepCard.test.tsx` (add smoke tests)
- `packages/web/src/components/GroupCard/GroupCard.test.tsx` (add smoke tests)

---

## Verification checklist

Before marking Done:

- [ ] Failing test committed before implementation
- [ ] `yarn test run` — all tests pass
- [ ] `yarn typecheck` — clean
- [ ] `yarn lint` — clean
- [ ] `yarn test:e2e` — passes (or noted in checklist if suite absent)
- [ ] Stories verified in `yarn storybook` — cards are draggable and interactive
- [ ] Checklist row updated to ✅ Done in `docs/react-migration-checklist.md`
- [ ] Pushed to `origin/react-migration`
