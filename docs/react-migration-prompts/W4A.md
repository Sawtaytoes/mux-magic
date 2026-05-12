# W4A spawn prompt — Verification & Master Merge

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W4A in the React Migration Recovery for media-tools.

**Working directory:** `d:\Projects\Personal\media-tools`
**Branch:** `react-migration` → `master` (after verification)
**Your model:** Sonnet 4.6, medium effort
**Your role:** Prove parity. Run all gates. Audit checklist accuracy. Merge `react-migration` into `master`. Tag the migration complete.

W4B is running in parallel in a worktree, authoring e2e specs. You two share only one file in practice — [docs/react-migration-checklist.md](../react-migration-checklist.md). Each of you edits only your own row. Use `Edit` (not `Write`); `git pull --rebase origin react-migration` before push. W4B won't touch any of your source files or merge to master before you do.

## Required reading before doing anything

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules apply (especially #2 pre-push gate, #4 no snapshot/VRT, #8 keep checklist honest).
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state. W3 just shipped final cleanup (4 commits, tip `7b92c62`). All Phase 2 + Phase 2.5 + Phase 3 workers are ✅ Done.
3. The W4A section of the handout — verification methodology.

## Critical context from orchestrator scan (post-W3)

**Test baseline:** `yarn test run` reports **1004 passing, 28 skipped, 137 test files**. If your pre-push gate shows fewer passing tests, something regressed.

**Legacy `packages/web/public/` is gone entirely** (verified — directory does not exist). W3's 4 commits:
- `28534ec` — deleted `public/builder/` and `public/vendor/`
- `ab00590` — deleted loose legacy assets in `public/`
- `5bc96ed` — slimmed `types.window.d.ts` to remaining bridge globals (shrinking-inventory pattern — see below)
- `7b92c62` — checklist update

**1 stale `window.mediaTools` reference remains:**
- [packages/web/src/components/PageHeader/PageHeader.mdx:2](../../packages/web/src/components/PageHeader/PageHeader.mdx#L2) — this is **MDX prose** (documentation), not code. It describes the legacy bridge in archival context. Decide during the audit whether to scrub it (parity-trap candidate for W5) or leave as historical documentation. Either way, it does not block your master merge.

**`types.window.d.ts` is now a shrinking inventory** (per W3's pattern saved in memory `feedback_shrinking_inventory_pattern.md`). It still exists with some entries — your audit verifies that each remaining entry is genuinely a bridge global still in use somewhere, OR document why it lingers (e.g., third-party globals, test-only stubs).

**Capture script for parity:** [packages/web/scripts/capture-parity-fixtures.ts](../../packages/web/scripts/capture-parity-fixtures.ts) — W0c built this with `buildParams` inlined and the `COMMANDS` import pointing at the legacy `public/builder/js/commands.js`. **The legacy file is gone now.** Your first audit task: update the script to import from `packages/web/src/commands/commands.ts` (the TS port from W1) and re-run it. Byte-for-byte identical YAML output proves end-to-end parity.

## Step-by-step

### Step 1 — Pre-merge gate
```bash
yarn test run
yarn typecheck
yarn lint
yarn build
```
All four must pass. `yarn build` is the production-bundle check — catches missing-asset references W3 might have left.

### Step 2 — Storybook smoke
```bash
yarn storybook
```
Walk every component story. Pay particular attention to the Wave B field components (all 13) and W2.5's DslRulesBuilder sub-components. **Manual visual check only — no VRT.**

### Step 3 — Parity matrix
Update the capture script to use the TS COMMANDS, then re-run:

1. Edit `packages/web/scripts/capture-parity-fixtures.ts` — change the `COMMANDS` dynamic import from `../public/builder/js/commands.js` (now deleted) to `import { COMMANDS } from "../src/commands/commands"`. Verify the script still typechecks (note: the `scripts/` dir is excluded from `packages/web/tsconfig.json`; run `yarn dlx tsx packages/web/scripts/capture-parity-fixtures.ts` to verify it runs).
2. Re-run the capture script. It will overwrite `packages/web/tests/fixtures/parity/<command>.yaml` files.
3. `git diff packages/web/tests/fixtures/parity/` — **every fixture must show zero changes**. Any diff is a parity gap — STOP and either reproduce as a bug, fix the underlying mismatch, or document the deliberate divergence.
4. Once `git diff` is empty for fixtures, the parity gate is closed.

Commit: `chore(scripts): update capture-parity-fixtures to import TS COMMANDS`.

### Step 4 — Checklist audit (your most important job)
The prior migration failed because the checklist drifted from reality. Read [docs/react-migration-checklist.md](../react-migration-checklist.md) row-by-row:

1. For every worker row marked ✅ Done, verify the corresponding code actually exists and works. Random-sample at least 3 components per phase. Run their tests. Manually exercise them in `yarn dev`.
2. For every "Done" sub-task checkbox (e.g. `[x] BooleanField`), grep the codebase to confirm the file and its test exist:
   ```bash
   ls packages/web/src/components/<Component>/
   yarn workspace @media-tools/web run test <Component>
   ```
3. If you find drift (checklist says Done, code says No), **STOP**. Reopen that worker's row as ⚠️ Blocked, document the gap, and notify the orchestrator. Do not merge to master until reality matches the checklist.
4. **Audit `types.window.d.ts`** — list every remaining global. For each, decide:
   - **Still a bridge global** — port to a Jotai atom (small follow-up commit) or, if it's genuinely a third-party / test-only stub, document why with a code comment.
   - **Orphaned** — delete the entry.
   If the file becomes empty, delete the file (this is the shrinking-inventory pattern's finish line).
5. Once the entire table is verified accurate: mark all rows ✅ Done with completion dates. Add a final entry to "Progress Log": `W4A | <date> | checklist audited; all rows verified against code`.

### Step 5 — Merge to master
Follow the repo's merge convention. Most likely a merge commit (preserves the worker-by-worker history) is the right shape here — squashing would erase the audit trail of who did what. Verify with the orchestrator if unclear.

```bash
git checkout master
git merge --no-ff react-migration -m "Merge react-migration: full React 19 migration recovery"
git tag react-migration-complete
git push origin master --tags
```

### Step 6 — Notify W4B
W4B is running in parallel in `.claude/worktrees/w4b` (or wherever they set up). They're waiting on your master merge before rebasing their `e2e-tests` branch and merging it. Once `master` is updated with the tag, post a note in the checklist's Progress Log: `W4A | <date> | merged to master; W4B can rebase + merge their e2e branch`.

## Pre-push gate (Universal Rule #2)

Every commit before push: `yarn test run && yarn typecheck && yarn lint`. The infrastructure is reliable as of commit `88802a6` (testing-library cleanup + ESLint ignores).

## Forbidden (Universal Rule #4)

No `toMatchSnapshot`, `toMatchInlineSnapshot`, `toHaveScreenshot`. Inline expected values only.

## Checklist updates (Universal Rule #8)

- At start: mark W4A 🔄 In Progress.
- After fixture script update: append to Progress Log.
- After parity matrix passes: append to Progress Log.
- After checklist audit: append to Progress Log AND mark every audited row Done.
- After master merge: mark W4A ✅ Done with a one-line summary.

## When done

Reply with:
- 4-gate status (test, typecheck, lint, build) — counts where relevant
- Parity matrix result — did all 36 fixtures round-trip cleanly?
- Checklist audit findings — any drift discovered? Any rows reopened as ⚠️ Blocked?
- `types.window.d.ts` final state — empty (file deleted) or which entries remain and why
- Master merge commit SHA + tag SHA
- Confirmation that W4B has been pinged via the Progress Log

The orchestrator will then generate W5 (cleanup) when W4B also reports done.
