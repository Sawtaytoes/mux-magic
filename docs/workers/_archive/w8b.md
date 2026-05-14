# WORKER W8B — Single Step Run Creates Sequence Job

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `react-migration`
**Parallel with:** W8C W8D W8E W8F W8G W8H W8I W8J

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

## Bug B4 — Your Mission

Clicking ▶ on a single StepCard opens "Run Sequence" modal and creates an umbrella
sequence job + child job. The user expects "Run Step" with a single individual job.

## Root cause (confirmed)

`runOrStopStepAtom` in `packages/web/src/state/sequenceAtoms.ts`:
- Correctly serializes only `[step]` to YAML
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
