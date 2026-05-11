# W7B spawn prompt — LinkPicker bug fixes (stored format + alignment + step paths + footer)

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W7B in the React Migration Recovery for media-tools.

**Working directory:** worktree at `.claude/worktrees/w7b` (set up below).
**Branch:** new `fix/link-picker` off `react-migration`; merges back to `react-migration` when done.
**Your model:** Sonnet 4.6, medium effort
**Your role:** Fix four parity gaps in the `LinkPicker` component found during manual verification.

W7B runs in parallel with W7A and W7C — file ownership is disjoint:
- W7A: modal primitives + Storybook config + one new story
- W7B: `LinkPicker.tsx` + `LinkPicker.test.tsx` (+ `links.ts` / `buildParams.ts` only if needed)
- W7C: `useBuilderActions.ts` + `sequenceAtoms.ts` + server `sequenceRunner.ts`

All four issues are **[PARITY]** — the legacy builder behaved correctly; the React port introduced these regressions.

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

## Bug 3 — Step items show no output path in detail

### Symptom

Path-variable items in the picker show their resolved path below the label (`workDir → /media/Anime/…`). Step items show the step label but **no path detail** — the detail row is blank. The legacy builder showed each step's computed output folder (e.g. `Step 1: Keep Languages → /media/…/LANGUAGE-TRIMMED`).

### Root cause

`buildItems` hardcodes `detail: ""` for step items:

```typescript
items.push({
  kind: "step",
  value: `step:${previousStep.id}:folder`,
  label: `Step ${entry.flatIndex + 1}: ${getCommandLabel(previousStep.command)}`,
  detail: "",  // ← always empty
  sourceStepId: previousStep.id,
})
```

### Fix

Add `commandsAtom` to the `LinkPicker`'s atom reads and compute each step's output folder using the existing `stepOutput` helper from `packages/web/src/commands/links.ts`.

```typescript
import { stepOutput } from "../../commands/links"
import { commandsAtom } from "../../state/commandsAtom"

// inside LinkPicker component:
const commands = useAtomValue(commandsAtom)

// in buildItems (needs commands + paths passed in):
const findStep = (id: string) =>
  flattenSteps(allSteps).find(e => e.step.id === id)?.step

items.push({
  kind: "step",
  ...
  detail: stepOutput(previousStep, paths, commands, findStep),
})
```

`buildItems` currently takes `(anchor, allSteps, paths)`. Add `commands` as a fourth argument (or inline the call inside the component where `commands` is already available). The `detail` rendering already handles empty strings gracefully (skips the detail `<div>` if falsy) — no render-side changes needed.

Add a test: when a step has a resolved output folder, that path appears as the detail text for the corresponding item.

---

## Bug 4 — Missing footer hint text

### Symptom

The legacy picker showed a footer: *"Don't see what you need? Close this and type a path directly into the field — it saves as a new path automatically."*

The React LinkPicker has no such footer. This hint is a [PARITY] UX affordance — it tells users they can type directly instead of picking, and that doing so will create a path variable automatically (a feature W7D will implement).

### Fix

Add a footer `<div>` at the bottom of the picker (outside `.overflow-y-auto`, inside the outer container), **only when there are no query results or always** — matching the legacy behavior (it was always visible). Suggested implementation:

```tsx
<div className="shrink-0 px-3 py-2 border-t border-slate-700 text-[11px] text-slate-500 italic">
  {"Don't see what you need? Close this and type a path directly into the field — it saves as a new path automatically."}
</div>
```

Add a test: the hint text is present in the rendered picker.

---

## Step-by-step

1. Set up worktree (above).
2. Run `yarn test run` to confirm baseline. You should see ~1040 tests passing (post W6A merge).
3. Fix `selectItem` in `LinkPicker.tsx` (Bug 1 — stored format).
4. Fix the test in `LinkPicker.test.tsx` (update line 164, add step-link format test).
5. Run `yarn test run` — all tests must pass.
6. Commit: `fix(link-picker): store bare pathVarId + step object instead of display strings`
7. Fix `computePosition` alignment in `LinkPicker.tsx` (Bug 2).
8. Commit: `fix(link-picker): center-align dropdown under trigger (was right-aligned)`
9. Add `commandsAtom` read + `stepOutput` call for step item details (Bug 3).
10. Add test for step detail path.
11. Commit: `fix(link-picker): show computed output path as detail for step items`
12. Add footer hint text (Bug 4).
13. Add test for footer text presence.
14. Commit: `fix(link-picker): restore "don't see what you need" footer hint`
15. Run the full gate (below).
16. Push and report.

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
