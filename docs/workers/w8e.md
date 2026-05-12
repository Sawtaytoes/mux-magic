# WORKER W8E — pathsAtom Stale State on Linked PathField

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8F W8G W8H W8I W8J

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

## Bug B7 — Your Mission

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
