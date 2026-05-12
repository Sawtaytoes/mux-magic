# Worker 03 — storybook-vitest-filter-fix

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/03-storybook-vitest-filter-fix`
**Worktree:** `.claude/worktrees/03_storybook-vitest-filter-fix/`
**Phase:** 0
**Depends on:** none
**Parallel with:** 01 02 04

---

## Universal Rules

1. **Branch & worktree — create them first**
   ```powershell
   git fetch origin
   git worktree add .claude/worktrees/03_storybook-vitest-filter-fix -b feat/mux-magic-revamp/03-storybook-vitest-filter-fix feat/mux-magic-revamp
   cd .claude/worktrees/03_storybook-vitest-filter-fix
   ```

2. **Port + PID convention** — see [04's prompt](04_worker-conventions-agents-md.md) section "Worker port/PID protocol" or the same section in `AGENTS.md` after worker 04 merges. Use random PORT/WEB_PORT, capture PID, tear down only your own PID.

3. **Pre-push gate:** `yarn lint → yarn typecheck → yarn test → (e2e if you touched runtime code) → yarn lint`.

4. **TDD:** write a test asserting the in-browser story-tests can spin up successfully. Test must fail before fix lands.

5. **Commit-and-push as you go.** Update your row in [docs/workers/README.md](README.md) at start (`in-progress`) and end (`done`).

6. **Test rules:** no snapshot, no screenshot. Inline expected values.

7. **Yarn only.** Never npm/npx.

---

## Your Mission

Running `yarn test:storybook` (or invoking the in-browser story tests via the Storybook UI) currently fails with:

```
Error

Failed to start Vitest

No projects matched the filter "storybook:D:/Projects/Personal/media-tools/packages/web/.storybook".

No projects matched the filter "storybook:D:/Projects/Personal/media-tools/packages/web/.storybook". Error:
    at Vitest._setServer (file:///D:/Projects/Personal/media-tools/node_modules/vitest/dist/chunks/cli-api.Cjt90eJu.js:13149:22)
    at BasicMinimalPluginContext.handler (file:///D:/Projects/Personal/media-tools/node_modules/vitest/dist/chunks/cli-api.Cjt90eJu.js:14175:5)
    at _createServer (file:///D:/Projects/Personal/media-tools/node_modules/vite/dist/node/chunks/node.js:26269:84)
    at createViteServer (file:///D:/Projects/Personal/media-tools/node_modules/vitest/dist/chunks/cli-api.Cjt90eJu.js:8818:17)
    at createVitest (file:///D:/Projects/Personal/media-tools/node_modules/vitest/dist/chunks/cli-api.Cjt90eJu.js:14205:18)
    at VitestManager.startVitest (file:///D:/Projects/Personal/media-tools/node_modules/@storybook/addon-vitest/dist/node/vitest.js:233:21)
```

The filter `"storybook:D:/Projects/Personal/media-tools/packages/web/.storybook"` is constructed by `@storybook/addon-vitest`'s `VitestManager.startVitest`. Vitest's project resolver does not match it because the actual project is registered with `name: "storybook"` (no path suffix).

This blocks the Storybook in-browser test runner from working at all, which downstream blocks any worker that wants to write or update component stories with portable test coverage.

## Root cause investigation (do this first)

1. Read [packages/web/vitest.storybook.config.ts](../../packages/web/vitest.storybook.config.ts) — note `name: "storybook"` at line 13.
2. Read [packages/web/.storybook/main.ts](../../packages/web/.storybook/main.ts) — see how the addon-vitest is configured. Confirm whether the `addons` array passes any `vitest` options that would influence the project filter.
3. Read [vitest.config.ts](../../vitest.config.ts) (root) — confirm `packages/web/vitest.storybook.config.ts` is listed under `test.projects`.
4. Open `node_modules/@storybook/addon-vitest/dist/node/vitest.js` around line 233 and trace how `VitestManager.startVitest` computes its project filter. The filter format is `<name>:<configDir>` — find where both halves come from.
5. Verify the addon version: `yarn info @storybook/addon-vitest version`. If there's a known issue, check the addon's GitHub for recent fixes.

## Likely fix paths (verify which one applies BEFORE picking)

- **A. Filter ignores the path half** — most likely. The addon computes `<name>:<configDir>` but vitest's project resolver only matches by `name`. Fix at the addon-call layer: tell the addon to pass just `name` (or strip the suffix from the filter). May require addon config in `.storybook/main.ts` like `addons: [{ name: "@storybook/addon-vitest", options: { projectFilter: "storybook" } }]` — verify the actual option shape from the addon's TypeScript types.
- **B. Project name mismatch** — the addon expects the project name to be `storybook:<absolute-configDir>` (i.e. it constructs the filter to match what it expects the project name to be). In that case, change `name: "storybook"` in `vitest.storybook.config.ts` to a dynamic value that matches the addon's format. Less likely; would surprise other vitest tooling.
- **C. Addon version bump** — if a recent `@storybook/addon-vitest` fixed this, upgrade. Currently pinned to `^10.3.6` in [packages/web/package.json](../../packages/web/package.json) line 42. Check the changelog at [storybook/storybook on GitHub](https://github.com/storybookjs/storybook).

Decide based on actual code inspection, not on this list.

## TDD steps

1. Write a failing integration test that programmatically invokes the addon's vitest startup (or runs `yarn test:storybook` via a child process) and asserts it does not throw the filter error. Place it under [packages/web/src/storybookTestStartup.test.ts](../../packages/web/src/storybookTestStartup.test.ts) (new file). Commit as `test(storybook): failing test for vitest filter`.
2. Implement the fix from the option you verified above.
3. Verify `yarn test:storybook` runs cleanly end-to-end.
4. Verify your failing-first test now passes.
5. Run full gate (`yarn lint → typecheck → test → lint`).

## Files

- [packages/web/vitest.storybook.config.ts](../../packages/web/vitest.storybook.config.ts)
- [packages/web/.storybook/main.ts](../../packages/web/.storybook/main.ts)
- [vitest.config.ts](../../vitest.config.ts) (root)
- [packages/web/package.json](../../packages/web/package.json) — `test:storybook` script + addon version
- Possibly: `node_modules/@storybook/addon-vitest/dist/node/vitest.js` (read-only, for understanding only — do not edit `node_modules`)

## Verification checklist

- [ ] Worktree created at `.claude/worktrees/03_storybook-vitest-filter-fix/`
- [ ] Manifest row updated to `in-progress`
- [ ] Failing test committed before the fix
- [ ] Root cause documented in PR description (which option above applied, with code citation)
- [ ] `yarn lint` clean
- [ ] `yarn typecheck` clean
- [ ] `yarn test` all passing (including new test)
- [ ] `yarn test:storybook` runs end-to-end without the filter error
- [ ] `yarn e2e` passing with your own PORT/WEB_PORT (sanity check that nothing else broke)
- [ ] `yarn lint` re-run after fix
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row updated to `done`

## Out of scope

- Visual/screenshot tests in Storybook — explicitly forbidden by AGENTS.md.
- Migrating Storybook to a different version (e.g. v11+). Stay on `^10.3.6` unless a version bump is the chosen fix and the user agrees.
- Touching unrelated story files — this is purely a config/wiring fix.
