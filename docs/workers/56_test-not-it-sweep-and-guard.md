# Worker 56 — test-not-it-sweep-and-guard

**Model:** Haiku · **Thinking:** OFF · **Effort:** Low
**Branch:** `feat/mux-magic-revamp/56-test-not-it-sweep-and-guard`
**Worktree:** `.claude/worktrees/56_test-not-it-sweep-and-guard/`
**Phase:** 4
**Depends on:** —
**Parallel with:** any worker that is **not** adding or rewriting tests. This worker rewrites ~5,000 lines across ~709 test files and will conflict with anything else that touches tests. Coordinate via MANIFEST status — flip to `in-progress` only when no other Phase-4/Phase-5 worker is mid-flight on a test-heavy change.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first (the failing "test" here is the new ESLint rule reporting on the existing `it(` calls — see TDD step 1). Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

The repo's test convention is **`test()`, not `it()`** — documented at [docs/agents/testing.md:22](../agents/testing.md#L22):

> Use `test()`, not `it()`. `it` and `test` are aliases; this repo uses `test` for consistency. Import `test` (not `it`) from `vitest`.

The convention exists, but nothing enforces it, so the codebase still carries ~5,014 `it(` calls across ~709 test files (`*.test.ts` + `*.test.tsx`). New workers keep writing `it(` because the existing files set the example.

Close the gap with two coupled changes:

1. **Sweep** every existing `it(` → `test(` (and `it.only` / `it.skip` → `test.only` / `test.skip`) across the test files.
2. **Guard** future regressions with an ESLint rule that fails the build on any `it(` in a test file.

The convention text in `docs/agents/testing.md` already covers the WHY ("`it` and `test` are aliases; this repo uses `test` for consistency"). No prose changes are needed there — but cross-link the new ESLint rule from that paragraph so a reader who hits the rule can trace it back to the convention.

### What to add — the guard (do this first, see TDD)

Install `@vitest/eslint-plugin` as a root devDependency. It ships [`vitest/consistent-test-it`](https://github.com/vitest-dev/eslint-plugin-vitest) which is exactly the rule we need and is **auto-fixable**, so we get the sweep for free in step 3.

Add a new flat-config block to [eslint.config.js](../../eslint.config.js) scoped to test files only:

```js
import vitestPlugin from "@vitest/eslint-plugin"

// inside defineConfig(...):
{
  files: ["**/*.test.{ts,tsx}"],
  plugins: { vitest: vitestPlugin },
  rules: {
    // AGENTS.md / docs/agents/testing.md convention: `test()`, not `it()`.
    // `it` and `test` are vitest aliases; this repo standardises on `test`
    // for consistency. Auto-fixable: `yarn lint --fix` rewrites `it(` → `test(`
    // and `it.only`/`it.skip` → `test.only`/`test.skip`.
    "vitest/consistent-test-it": ["error", { fn: "test" }],
  },
},
```

Scope the block to `**/*.test.{ts,tsx}` (not all `.ts`) so that:

- e2e specs in `e2e/*.spec.ts` are unaffected — they use Playwright's `test`, which is a different package and a different rule surface.
- Non-test source that happens to name a function `it` (unlikely, but possible) doesn't get flagged.

Place the new block in [eslint.config.js](../../eslint.config.js) **after** the existing `{ files: ["packages/web/**/*.{ts,tsx}"] }` blocks — flat config is order-sensitive only for `ignores`, but keeping test-specific rules at the bottom of the file matches the file's current structure.

### What to add — the sweep

With the rule in place and auto-fixable, the sweep is one command:

```bash
yarn lint --fix
```

That rewrites every `it(` → `test(`, `it.only` → `test.only`, `it.skip` → `test.skip` across all `*.test.{ts,tsx}` files. **Verify counts before/after** so the diff is fully accounted for:

- Before: `grep -rE "^\s*it\(" --include="*.test.ts" --include="*.test.tsx" packages/ | wc -l` should report ~5,014.
- After: same command should report `0`.

### Two manual edge cases the auto-fix won't catch

1. **Imports of `it` from `vitest`.** `vitest/consistent-test-it` rewrites call sites, not imports. After `--fix`, audit:

   ```bash
   grep -rnE "import\s*\{[^}]*\bit\b[^}]*\}\s*from\s*['\"]vitest['\"]" --include="*.ts" --include="*.tsx" packages/
   ```

   For each hit: drop `it` from the import list; add `test` if not already present. If a file *only* imported `it`, the post-fix `it` references are gone so just rename the import. This is mechanical — use the Edit tool per file.

2. **`describe.skip` blocks containing `it(` calls.** The grep showed 6 `describe.skip` instances. The auto-fix still rewrites their inner `it(` → `test(` regardless of the outer block state — verify by re-running the count above.

The grep also showed `21 test.each` and `0 it.each`, so there's nothing to migrate on the `.each` axis.

### What stays unaffected

- **Playwright e2e specs.** `e2e/*.spec.ts` use a different `test` (from `@playwright/test`). The new ESLint block's `files` glob doesn't include them.
- **`docs/agents/testing.md`** prose. The convention statement at line 22 already says what we want; just add a parenthetical pointing readers to the new ESLint rule for the enforcement story.
- **Vitest behavior.** `it` and `test` are runtime aliases in vitest — the sweep is a pure rename with zero behavior change. Test counts before/after should be identical; failure counts should be identical (modulo any tests that were already broken on `feat/mux-magic-revamp`).

## TDD steps

1. **Red.** Install `@vitest/eslint-plugin` + add the `vitest/consistent-test-it` block in [eslint.config.js](../../eslint.config.js). Run `yarn lint`. It should now report ~5,014 errors across ~709 files — that's the failing-test analogue. Commit `chore(eslint): forbid it() in test files via vitest/consistent-test-it (5014 errors expected)`.
2. **Green (mechanical).** Run `yarn lint --fix`. Re-run `yarn lint` — should report 0 errors from this rule. Commit `refactor(tests): sweep it() → test() across all test files (auto-fix)`. This is a single ~5,000-line diff; that's expected and reviewable because every line is the same shape.
3. **Green (manual).** Grep for residual `it` imports from `vitest` (command above). For each: Edit the import to drop `it` (and add `test` if missing). Commit `refactor(tests): drop unused 'it' imports from vitest`.
4. **Verify behavior unchanged.** Run `yarn test` from root. Total test count and pass/fail breakdown should match the pre-sweep baseline. If anything regresses, the sweep touched something it shouldn't have — investigate before continuing.
5. **Cross-link the rule.** Edit [docs/agents/testing.md:22](../agents/testing.md#L22) to add a trailing sentence: "Enforced by the `vitest/consistent-test-it` ESLint rule (see [eslint.config.js](../../eslint.config.js))." Commit `docs(agents): point testing.md convention at its ESLint enforcement`.
6. **Standard gate.** `yarn lint → typecheck → test → e2e → lint`. Commit any final cleanup.
7. **Manifest.** Dedicated `chore(manifest):` flip commits for `in-progress` (at the start) and `done` (after merge).

## Files

- [eslint.config.js](../../eslint.config.js) — add `vitest/consistent-test-it` rule block + the `vitestPlugin` import.
- Root [package.json](../../package.json) — add `@vitest/eslint-plugin` to `devDependencies`.
- [docs/agents/testing.md](../agents/testing.md) — one-sentence cross-link to the new rule.
- **All `**/*.test.{ts,tsx}` under `packages/`** — auto-fixed in step 2. Expect ~709 files touched, ~5,014 line rewrites. Plus the small import-list cleanups in step 3.

## Out of scope

- **Renaming the convention itself.** The user prefers `test(`; the convention is already documented; we are not re-litigating.
- **Storybook `*.stories.{ts,tsx}` files.** They don't run as vitest tests in the unit sense; they use `play` functions. Out of scope for this rule.
- **Storybook-vitest portable-stories tests.** If any future Storybook→vitest bridge generates `it(` calls, that's a follow-up — the rule still catches them, but Worker 56 won't pre-emptively retrofit.
- **e2e specs (`e2e/*.spec.ts`).** Playwright `test` is a different namespace; the file glob explicitly excludes them.
- **Migrating test bodies / assertions / fixtures.** This is a rename-only sweep, not a refactor.

## Verification checklist

- [ ] Worktree created; MANIFEST row → `in-progress` in its own `chore(manifest):` commit
- [ ] `@vitest/eslint-plugin` listed in root [package.json](../../package.json) `devDependencies`
- [ ] `eslint.config.js` has the new test-files-only block with `vitest/consistent-test-it: ["error", { fn: "test" }]`
- [ ] `yarn lint` reports **0** errors from `vitest/consistent-test-it` after the sweep
- [ ] `grep -rE "^\s*it\(" --include="*.test.ts" --include="*.test.tsx" packages/` returns no matches
- [ ] No `import { ..., it, ... } from "vitest"` lines remain (grep above is empty)
- [ ] `yarn test` total count and pass/fail breakdown unchanged vs. pre-sweep baseline
- [ ] [docs/agents/testing.md:22](../agents/testing.md#L22) paragraph cross-links the ESLint rule
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
