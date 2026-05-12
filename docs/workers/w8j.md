# WORKER W8J — Path Variable Deletion with In-Use Guard

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8D W8E W8F W8G W8H W8I

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

## Bug B15 — Your Mission

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
  write handler. Use `flattenSteps` (already exists in `sequenceUtils.ts`) to walk all
  steps including those inside groups.
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
