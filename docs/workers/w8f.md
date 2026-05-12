# WORKER W8F — PathField Typeahead Keyboard Navigation Broken

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8E W8G W8H W8I W8J

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

## Bug B8 — Your Mission

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
- The `PathPicker` component directory (search: grep for `pathPickerState` in `packages/web/src/`)
- `packages/web/public/builder/js/` — master's original implementation for reference

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
