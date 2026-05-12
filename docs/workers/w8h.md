# WORKER W8H — Paste and Delete Card Animations

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8E W8F W8G W8I W8J

---

## Universal Rules

1. **Branch:** all work on `react-migration`. No new branches.

2. **TDD workflow — mandatory:**
   - Write the test first. The test must fail before you write any fix code.
   - Commit the failing test: `test(<area>): failing test for <bug description>`
   - Write the minimum code to make the test pass.
   - Commit the fix: `fix(<area>): <description>`
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

## Bug B12 — Your Mission

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

## Verification checklist

Before marking Done:

- [ ] Failing test committed before fix code
- [ ] `yarn test run` — all tests pass
- [ ] `yarn typecheck` — clean
- [ ] `yarn lint` — clean
- [ ] `yarn test:e2e` — passes (or noted in checklist if suite absent)
- [ ] New tests cover the exact regression scenario
- [ ] Checklist row updated to ✅ Done in `docs/react-migration-checklist.md`
- [ ] Pushed to `origin/react-migration`
