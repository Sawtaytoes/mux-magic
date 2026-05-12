# WORKER W8D — Info Panel Field Descriptions

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `react-migration`
**Parallel with:** W8B W8C W8E W8F W8G W8H W8I W8J

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

## Bug B6 — Your Mission

The ⓘ Info panel (`CommandHelpModal` → `CommandFieldEntry.tsx`) shows
"No description yet — add one in src/api/schemas.ts" for every field.
Field tooltips (hover labels) work fine — only the Info panel is broken.

## Root cause (confirmed)

- Build script: `packages/server/scripts/build-command-descriptions.ts`
- Root `package.json` defines `"preapi-dev-server": "yarn build:command-descriptions"`
- But `yarn start` calls `dev:api-server` (not `api-dev-server`), so the pre-hook name
  never matches and descriptions are never generated in dev.

## TDD steps

1. Write a test asserting the generated descriptions output file is non-empty and
   contains at least one field description string. This test must fail first.
2. Run the script manually:
   ```bash
   yarn build:command-descriptions
   ```
3. Identify the output file it writes. Commit it.
4. Fix the pre-hook so it fires on `yarn start`. In root `package.json` add:
   ```json
   "predev:api-server": "yarn build:command-descriptions"
   ```
   Keep the existing `preapi-dev-server` in case other callers use it.
5. Verify the test passes and the Info panel shows real descriptions after a fresh start.

## Files

- `packages/server/scripts/build-command-descriptions.ts` — the generator
- `package.json` (root) — add `predev:api-server` hook
- Generated output file (determine from running the script)

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
