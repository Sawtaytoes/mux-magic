# W7D spawn prompt — PathField typing behavior + PathPicker wiring

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W7D in the React Migration Recovery for media-tools.

**Working directory:** worktree at `.claude/worktrees/w7d` (set up below).
**Branch:** new `fix/path-field-typing` off `react-migration`; merges back to `react-migration` when done.
**Your model:** Sonnet 4.6, medium effort
**Your role:** Restore two PathField behaviors lost in the React migration: (1) typing into a linked PathField should update the linked path variable's value, not write a literal param; (2) typing when no path var is linked should create a new path variable and link the field to it. Also wire the PathPicker (directory listing dropdown from server `/files`) to PathField and PathVarCard text inputs.

W7D runs after W7B is merged (depends on the link-format fix). W7D is parallel with W7A and W7C (disjoint files):
- W7A: modal primitives + Storybook config + one new story
- W7C: `useBuilderActions.ts` + `sequenceAtoms.ts` + `sequenceRunner.ts`
- W7D: `PathField.tsx` + `PathVarCard.tsx` + `PathPicker.tsx` (+ `useBuilderActions.ts` for `setPathValue` only if W7C hasn't touched it — coordinate if needed)

All issues are **[PARITY]** — the legacy builder behaved correctly; the React port introduced these regressions.

## Required reading

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules.
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state.
3. `packages/web/src/components/PathField/PathField.tsx` — current implementation.
4. `packages/web/src/components/PathVarCard/PathVarCard.tsx` — path variable card.
5. `packages/web/src/components/PathPicker/PathPicker.tsx` — directory listing picker (currently wired only to PathVarCard's 📁 button, NOT to the text input keystroke).
6. `packages/web/src/hooks/useBuilderActions.ts` — look for `setParam`, `setPathValue`, `addPathVar`, `setLink`.
7. `packages/web/src/state/sequenceAtoms.ts` — look for `setPathValueAtom`.

## Worktree setup

```bash
git worktree add .claude/worktrees/w7d -b fix/path-field-typing react-migration
cd .claude/worktrees/w7d
yarn install
```

---

## Bug 1 — Typing into a linked PathField doesn't update the path variable

### Symptom

When a `PathField` has a link set to a path variable (e.g. `link = "basePath"`), typing into the text input has no effect — the field snaps back to the computed value on every keystroke. The user cannot update the path variable by typing into the field.

### Root cause

`PathField.tsx` `onChange` calls `setParam(step.id, field.name, value)` unconditionally. But `setParam` writes to `step.params`, while the displayed `displayValue` comes from `getLinkedValue(...)` (the path variable's value). Writing to `step.params` has no effect on the displayed value because `displayValue = link != null ? computedValue : manualValue`.

Additionally, when `isObjectLink` is true (the link is `{ linkedTo, output }`), the input is `readOnly`. But for path-variable links (string form), `isObjectLink` is false and the input is editable — yet editing does nothing useful.

### Fix

In `PathField.tsx`, update `onChange` to:

```typescript
onChange={(event) => {
  if (isObjectLink) return
  const value = event.target.value || undefined
  if (typeof link === "string") {
    // Linked to a path variable — update the path variable's value
    setPathValue(link, value ?? "")
  } else {
    // No link — update the step param directly
    setParam(step.id, field.name, value)
  }
}}
```

Where `setPathValue` comes from `useBuilderActions`:
```typescript
const { setParam, setPathValue } = useBuilderActions()
```

Verify `setPathValue(pathVarId, value)` exists in `useBuilderActions.ts`. If it calls `setPathValueAtom`, check `sequenceAtoms.ts` to confirm the atom signature. Do NOT duplicate the implementation — use what's already there.

### Tests to add

- Render a `PathField` with `step.links.sourcePath = "basePath"` and `paths = [{ id: "basePath", value: "/old/path" }]`
- Simulate a change event on the input
- Assert `setPathValue` was called with `("basePath", "/new/path")` and `setParam` was NOT called

---

## Bug 2 — Typing into an unlinked PathField doesn't create a new path variable

### Symptom

When a `PathField` has no link (user is on "— custom —"), typing a path value should:
1. Create a new path variable with that value
2. Link the field to the new path variable

This was the legacy behavior. In React, typing only calls `setParam` which stores a literal string in `step.params` — no path variable is created or linked.

### Fix

In `PathField.tsx`, extend the `onChange` handler with a `createPathVarAndLink` action (or inline using `addPathVar` + `setLink`):

```typescript
} else {
  // No link — check if we should auto-create a path var
  const newValue = event.target.value
  if (newValue) {
    // Create a new path variable and link this field to it
    const newId = createPathVarAndLink(step.id, field.name, newValue)
  } else {
    setParam(step.id, field.name, undefined)
  }
}
```

Look at `useBuilderActions.ts` for `addPathVar` and `setLink`. If `createPathVarAndLink` doesn't exist as a combined action, implement it inline using the two atoms:
```typescript
const newId = crypto.randomUUID().slice(0, 8)
addPathVar(newId, newValue)
setLink(step.id, field.name, newId)
```

Where `addPathVar(id, value)` and `setLink(stepId, fieldName, link)` come from `useBuilderActions`.

**Important:** Only auto-create the path var on the first character typed (when `link == null && !step.params[field.name]`). For subsequent keystrokes, call `setPathValue(existingLink, newValue)`. In practice, the simplest implementation: if `link == null` and input has a value, create+link on first blur (not every keystroke). Check what the legacy behavior was — it may have been on `onBlur` rather than `onChange`.

### Tests to add

- Render with no link and no param value; type a path; assert `addPathVar` + `setLink` are called
- Render with no link but an existing `step.params.sourcePath`; update the value; assert `setParam` is called (not `addPathVar`)

---

## Bug 3 — PathPicker not wired to PathField text input

### Symptom

Typing in a `PathVarCard` text input does NOT show a directory-listing dropdown (PathPicker). The 📁 button opens the `FileExplorerModal` instead. In the legacy builder, typing a path prefix in any path input triggered a dropdown listing matching directories from the server's `/files` endpoint.

### Investigation

Read `PathPicker.tsx` to understand its current API. It may already have the directory-listing logic but be triggered only from specific code paths (e.g., `PathVarCard`'s 📁 button). Check `pathPickerStateAtom` in `pickerAtoms.ts`.

Also check: does `PathField`'s text input have any keystroke handler that calls the PathPicker? If the PathPicker is a popover triggered by a separate button (not by input keystroke), the legacy "type to search directories" behavior may need the PathPicker to be wired to `onChange` with debounce.

### Fix

Wire the PathPicker to both:
1. `PathField`'s text input: on `onChange` with debounce (250ms), open PathPicker at the input's position if value looks like a partial path (starts with `/`).
2. `PathVarCard`'s text input: same treatment.

The PathPicker `onSelect` callback should:
- For `PathField`: call `setPathValue(link, selectedPath)` if linked, else `setParam(step.id, field.name, selectedPath)`
- For `PathVarCard`: call `setPathValue(pathVar.id, selectedPath)`

If `PathPicker` already handles this differently (e.g., via a shared atom), adapt to the existing pattern rather than inventing a new one.

**Note:** This bug is lower priority than Bugs 1 and 2. If the PathPicker wiring requires significant new state management (a new atom, new server calls), skip it and note it as deferred to a future worker.

---

## Step-by-step

1. Set up worktree (above).
2. Run `yarn test run` to confirm baseline (~1046 tests).
3. Read `useBuilderActions.ts` to confirm `setPathValue`, `addPathVar`, `setLink` signatures.
4. Fix Bug 1 (`onChange` calls `setPathValue` when linked to path var). Add tests.
5. Run `yarn test run` — all tests must pass.
6. Commit: `fix(path-field): typing updates linked path variable value (not step param)`
7. Fix Bug 2 (auto-create path var on first input when unlinked). Add tests.
8. Run `yarn test run` — all tests must pass.
9. Commit: `fix(path-field): typing when unlinked creates and links a new path variable`
10. Investigate Bug 3 (PathPicker wiring). Implement if feasible within scope; skip if complex.
11. If implemented: commit `fix(path-picker): wire directory-listing dropdown to PathField + PathVarCard inputs`
12. Run the full gate (below).
13. Push and report.

---

## Pre-push gate (Universal Rule #2)

```bash
yarn test run
yarn typecheck
yarn lint
```

All three green.

## Checklist updates (Universal Rule #8)

- At start: mark W7D 🔄 In Progress in [docs/react-migration-checklist.md](../react-migration-checklist.md).
- Per commit: append to Progress Log.
- At end: mark W7D ✅ Done.

## Handoff

```bash
cd .claude/worktrees/w7d
yarn test run && yarn typecheck && yarn lint
git push origin fix/path-field-typing
```

Merge directly per repo convention (`git merge --no-ff`). After merge:

```bash
cd ../..
git worktree remove .claude/worktrees/w7d
git branch -d fix/path-field-typing
```

## When done

Reply with:
- Test count before/after
- Confirm Bug 1 + Bug 2 fixed
- Bug 3 status (implemented or deferred)
- Whether `setPathValue` / `addPathVar` already existed in `useBuilderActions.ts` or needed to be added
- Pre-push gate state
