# W7B spawn prompt — LinkPicker bug fixes (stored format + alignment)

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W7B in the React Migration Recovery for media-tools.

**Working directory:** worktree at `.claude/worktrees/w7b` (set up below).
**Branch:** new `fix/link-picker` off `react-migration`; merges back to `react-migration` when done.
**Your model:** Sonnet 4.6, medium effort
**Your role:** Fix two bugs in the `LinkPicker` component that were found during manual verification.

W7B runs in parallel with W7A and W7C — file ownership is disjoint:
- W7A: modal primitives + Storybook config + one new story
- W7B: `LinkPicker.tsx` + `LinkPicker.test.tsx` (+ `links.ts` / `buildParams.ts` only if needed)
- W7C: `useBuilderActions.ts` + `sequenceAtoms.ts` + server `sequenceRunner.ts`

Both bugs are **[PARITY]** — the legacy builder behaved correctly; the React port introduced these regressions.

## Required reading

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules.
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state.
3. `packages/web/src/components/LinkPicker/LinkPicker.tsx` — the component.
4. `packages/web/src/components/LinkPicker/LinkPicker.test.tsx` — existing tests.
5. `packages/web/src/commands/buildParams.ts` and `packages/web/src/commands/links.ts` — how stored links are consumed downstream.
6. `packages/web/tests/fixtures/parity/copyFiles.yaml` — canonical YAML format for path references (`@basePath`, not `@path:basePath`).

## Worktree setup

```bash
git worktree add .claude/worktrees/w7b -b fix/link-picker react-migration
cd .claude/worktrees/w7b
yarn install
```

---

## Bug 1 — Wrong stored format for link values

### Symptom

When a user opens the link picker (the `▾` dropdown button on a `PathField`) and selects a path variable, re-opening the picker always highlights the **first** item regardless of which variable is currently selected. Additionally, any YAML generated from a sequence with a path link is broken (path reference serialized as `@path:basePath` instead of `@basePath`).

### Root cause (already investigated by orchestrator)

`LinkPicker.selectItem` calls `setLink(anchor.stepId, anchor.fieldName, item.value)`. For path items, `item.value` is `"path:basePath"` (the full discriminated display key). But **every consumer in the codebase expects the bare pathVarId** (`"basePath"`):

| Consumer | Where | Expectation |
|---|---|---|
| `buildParams.ts` | `return \`@${link}\`` | Produces `@basePath` for YAML |
| `getLinkedValue` in `links.ts` | `paths.find(pv => pv.id === link)` | Matches `id: "basePath"` |
| `resolveLinkLabel` in `PathField.tsx` | `paths.find(pv => pv.id === link)` | Resolves display label |
| `findInitialIndex` in `LinkPicker.tsx` | `item.pathVarId === link` | Finds current selection on re-open |

Parity fixture `copyFiles.yaml` confirms the correct YAML format: `sourcePath: '@basePath'` (bare `@pathVarId`).

For **step output links**, `item.value` is the string `"step:stepId:folder"`, but all consumers expect the object form `{ linkedTo: stepId, output: "folder" }`. The `buildParams.ts` and `getLinkedValue` only handle the object form for step links.

### Fix in `LinkPicker.tsx` — `selectItem` function

Change `selectItem` from:
```typescript
const selectItem = (item: LinkItem) => {
  const anchor = pickerState?.anchor
  close()
  if (anchor) {
    setLink(anchor.stepId, anchor.fieldName, item.value)
  }
}
```

To:
```typescript
const selectItem = (item: LinkItem) => {
  const anchor = pickerState?.anchor
  close()
  if (!anchor) return
  if (item.kind === "path") {
    setLink(anchor.stepId, anchor.fieldName, item.pathVarId)
  } else {
    setLink(anchor.stepId, anchor.fieldName, {
      linkedTo: item.sourceStepId,
      output: "folder",
    })
  }
}
```

### Fix in `LinkPicker.test.tsx`

The existing test at line 164 documents the broken behavior:
```typescript
expect(step3?.links.sourcePath).toBe("path:basePath")
```

Update it to the correct format:
```typescript
expect(step3?.links.sourcePath).toBe("basePath")
```

Also add a test for step link selection — verify that clicking a step-link item stores the object form `{ linkedTo: "step-1", output: "folder" }`, not the display string.

### Verify `findInitialIndex` is correct after the fix

`findInitialIndex` already handles both forms correctly once the stored format matches:
- `typeof link === "string"` → `item.pathVarId === link` ✅ (now `link = "basePath"`, `pathVarId = "basePath"`)
- `link.linkedTo` → `item.sourceStepId === link.linkedTo` ✅

No changes needed in `findInitialIndex`.

---

## Bug 2 — LinkPicker opens right-aligned (should be center-aligned)

### Symptom

The link picker dropdown opens flush with the right edge of its trigger button. The user confirmed this was changed from the legacy HTML version and should be center-aligned.

### Root cause

`computePosition` in `LinkPicker.tsx` uses:
```typescript
// Link picker aligns to the right edge of its trigger
const initialLeft = rect.right - width
```

### Fix

Change to center-align under the trigger:
```typescript
const initialLeft = Math.round((rect.left + rect.right) / 2 - width / 2)
```

Remove the stale comment. The clamping logic below (`if (initialLeft + width > window.innerWidth - margin)` etc.) remains unchanged — it already handles the viewport edge cases correctly for any `initialLeft`.

---

## Step-by-step

1. Set up worktree (above).
2. Run `yarn test run` to confirm baseline. You should see ~1046 tests passing.
3. Fix `selectItem` in `LinkPicker.tsx`.
4. Fix the test in `LinkPicker.test.tsx` (update line 164, add step-link test).
5. Run `yarn test run` — all tests must pass.
6. Commit: `fix(link-picker): store bare pathVarId + step object instead of display strings`
7. Fix `computePosition` alignment in `LinkPicker.tsx`.
8. Commit: `fix(link-picker): center-align dropdown under trigger (was right-aligned)`
9. Run the full gate (below).
10. Push and report.

---

## Pre-push gate (Universal Rule #2)

```bash
yarn test run
yarn typecheck
yarn lint
```

All three green. No snapshot tests, no VRT tests.

## Checklist updates (Universal Rule #8)

- At start: mark W7B 🔄 In Progress in [docs/react-migration-checklist.md](../react-migration-checklist.md).
- Per commit: append to Progress Log.
- At end: mark W7B ✅ Done.

## Handoff

```bash
cd .claude/worktrees/w7b
yarn test run && yarn typecheck && yarn lint
git push origin fix/link-picker
```

Merge directly per repo convention (`git merge --no-ff`). After merge:

```bash
cd ../..
git worktree remove .claude/worktrees/w7b
git branch -d fix/link-picker
```

## When done

Reply with:
- Test count before/after
- Confirm both bugs fixed (stored format + alignment)
- Whether any other consumers of the link format needed updating beyond `LinkPicker.tsx`
- Pre-push gate state
