# W4B spawn prompt — E2E Tests (Playwright, worktree)

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W4B in the React Migration Recovery for media-tools.

**Working directory:** initially `d:\Projects\Personal\media-tools`, then your own worktree (see Worktree Setup below).
**Branch:** new `e2e-tests` branch off `react-migration` (post-W3 state), eventually merges into `master` after W4A.
**Your model:** Sonnet 4.6, medium effort
**Your role:** Author Playwright e2e specs in `e2e/`. Run in parallel with W4A's verification + master merge. Wait for W4A's master merge before rebasing your branch and merging.

## Required reading before doing anything

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules (especially #4 no snapshot/VRT — applies to e2e specs too: never `toHaveScreenshot()`).
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state. W3 just shipped (4 commits, tip `7b92c62`). Phase 3 is complete; the app is 100% React.
3. The W4B section of the handout — coordination rules with W4A.
4. The existing Playwright config: [playwright.config.ts](../../playwright.config.ts) at repo root, and the `e2e/` directory contents.

## Worktree setup

Run from the main checkout:

```bash
git worktree add .claude/worktrees/w4b -b e2e-tests react-migration
cd .claude/worktrees/w4b
yarn install
```

This mirrors WBN-A's pattern (worktree at `.claude/worktrees/wbn-a`). All your work happens in this worktree. The main checkout (where W4A is working) is untouched.

## Coordination with W4A (critical)

- **You only write files under `e2e/`.** Do not touch `packages/web/src/` — that's W4A's verification surface.
- **Do NOT modify `package.json` or `yarn.lock`.** Playwright is already installed. If you need a new dependency (e.g., a tiny utility helper), **STOP** and notify the orchestrator — the install + yarn.lock change must be coordinated with W4A to avoid a merge conflict on master.
- **Checklist edits:** only your own W4B row. Use `Edit` tool (not `Write`); `git pull --rebase origin react-migration` before each push.
- **You do not merge to master.** Wait for W4A to merge react-migration → master and post in the Progress Log. Then rebase your `e2e-tests` branch onto master and merge when your specs pass.

## Step-by-step

### Step 1 — Survey existing e2e setup
Read the Playwright config and any existing `e2e/*.spec.ts` files. Note:
- Which port/URL the config probes (Hono prod vs Vite dev) — recent CI commits indicate Playwright probes `:4173` for the production preview server.
- Any existing helpers, fixtures, or page-object patterns.

### Step 2 — Author specs covering the major user flows

Use the existing config and `e2e/` directory. Cover at minimum:

1. **Builder round-trip:** open `/builder` → create a sequence with at least one step of each major command type → copy YAML → reload → load YAML back → assert sequence matches.
2. **Jobs SSE:** open `/` (jobs page) → start a job → observe SSE streaming progress → confirm completion state.
3. **Modals:** LoadModal, YamlModal, CommandHelpModal, ApiRunModal, PromptModal, LookupModal, FileExplorerModal — each opens, accepts input, closes cleanly.
4. **Drag-and-drop:** reorder steps in a sequence; move steps between groups; assert order persists in YAML output.
5. **(Optional, valuable)** DslRulesBuilder (W2.5 worker's deliverable) — exercise rule add/remove/expand-details. Use the `modifySubtitleMetadata` command to access it.

### Step 3 — Assertion style (NON-NEGOTIABLE)

**No `toHaveScreenshot()` calls. No Percy. No Chromatic. No image-diff at all.** Use semantic assertions:
- `expect(page.getByRole(...)).toBeVisible()`
- `expect(locator).toHaveText("literal value")`
- `expect(locator).toHaveCount(n)`
- `expect(locator).toHaveAttribute("aria-required", "true")` (a11y checks are fine)

See Universal Rule #4 — no VRT under any framework. This rule was just added to [AGENTS.md](../../AGENTS.md) (commit `3f8bf84`).

### Step 4 — Update the checklist
- At start: mark W4B 🔄 In Progress in [docs/react-migration-checklist.md](../react-migration-checklist.md) (in main checkout via `git pull --rebase`).
- Per spec landed: append a line to the Progress Log.
- At end (specs all green): mark W4B 🟡 Ready-to-merge (waiting on W4A's master merge). Once W4A merges, you rebase and merge, then mark W4B ✅ Done.

## Pre-push gate (Universal Rule #2)

Every commit before push:

```bash
yarn test run
yarn typecheck
yarn lint
yarn e2e
```

All four must pass. `yarn e2e` is in your gate because you're authoring e2e specs — adding broken specs is worse than no specs.

## Commits

One commit per spec file. Push as you go to your `e2e-tests` branch on origin.

Suggested commit shape:
- `test(e2e): builder round-trip — sequence editor + YAML copy/load`
- `test(e2e): jobs page SSE streaming`
- `test(e2e): builder modals open/close cycle`
- `test(e2e): drag-and-drop step reordering`
- `test(e2e): DslRulesBuilder rule mutations`

## Handoff (post-W4A merge)

1. Wait for the Progress Log entry `W4A | <date> | merged to master; W4B can rebase + merge their e2e branch`.
2. From your worktree:
   ```bash
   git fetch origin master
   git rebase origin/master
   yarn test run && yarn typecheck && yarn lint && yarn e2e   # re-verify after rebase
   git push origin e2e-tests
   ```
3. Open a PR `e2e-tests` → `master`, or merge directly per repo convention. Confirm with the orchestrator if unclear.
4. After merge, clean up the worktree:
   ```bash
   cd ../../..   # back to main checkout
   git worktree remove .claude/worktrees/w4b
   git branch -d e2e-tests
   ```
5. Mark W4B ✅ Done. Then notify the orchestrator that W5 (cleanup) can spawn whenever the user is ready.

## Forbidden (Universal Rule #4)

Reiterating because e2e is where this rule is most often broken: NO `toHaveScreenshot`, NO Percy, NO Chromatic, NO Storybook screenshot tests. Semantic assertions only.

## When done

Reply with:
- List of spec files authored, with one-line summary of what each covers
- `yarn e2e` final result (pass count, any flaky tests)
- Pre-merge state (waiting on W4A) vs post-merge state (rebased + merged)
- Any deviations from the suggested spec list (e.g., skipped DslRulesBuilder because of flakiness)
- Worktree cleanup confirmation
- Any blockers
