# Worker 05 — is-has-eslint-rule

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/05-is-has-eslint-rule`
**Worktree:** `.claude/worktrees/05_is-has-eslint-rule/`
**Phase:** 1A (serial chain)
**Depends on:** 01 (rename complete)
**Parallel with:** none (Phase 1A is serial; touches `eslint.config.js`)

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. PID capture/teardown. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Commit + push as you go. Yarn only. See [AGENTS.md](../../AGENTS.md) "Worker port/PID protocol" (added by worker 04) for full details.

## Your Mission

Add an ESLint rule enforcing the `is`/`has` boolean naming convention already mandated by [AGENTS.md](../../AGENTS.md) ("Booleans start with `is` or `has`"). The rule has been a manual review item; this worker makes it machine-enforced. Then sweep the codebase for current violations and rename them.

### ESLint rule approach

Use `@typescript-eslint/naming-convention` with a `types: ["boolean"]` selector and `prefix: ["is", "has"]`:

```js
{
  selector: ["variable", "parameter", "property"],
  types: ["boolean"],
  format: null,                    // don't enforce case; just prefix
  prefix: ["is", "has"],
  filter: { regex: "^(__|_)", match: false }  // ignore underscore-prefixed
}
```

Verify the exact selector+filter combination by reading the [typescript-eslint naming-convention docs](https://typescript-eslint.io/rules/naming-convention/) AND running `yarn lint` to see what fires.

### Sweep strategy

After the rule lands, `yarn lint` will fail with boolean-naming errors throughout the repo. Per [feedback_rename_strategy.md](C:\Users\satur\.claude\projects\d--Projects-Personal-media-tools\memory\feedback_rename_strategy.md), use a hybrid: ESLint catches declarations; references must be updated manually or via `replace_all`.

Suggested commit chunks (one per logical area):
1. ESLint config addition (in `eslint.config.js`)
2. Web boolean renames (one commit per package or per concern)
3. Server boolean renames
4. Shared boolean renames

If you encounter ambiguous cases (e.g., a boolean named `success` — `isSuccessful`? `hasSucceeded`?), flag them in your PR for the user to decide.

## TDD steps

1. Add the rule to `eslint.config.js`. Run `yarn lint` — confirm it now reports boolean violations.
2. Write a small unit test (Vitest) that imports a fixture file with a boolean named `wrongName`, runs ESLint programmatically, and asserts a violation is reported. Commit as `test(eslint): is/has rule reports violations`. (If programmatic ESLint testing is heavyweight, this can be a `// eslint-disable-next-line` annotation test instead — pick whichever is simpler.)
3. Sweep violations one logical chunk at a time. Per chunk: rename declarations, then grep for old names and update references.
4. `yarn lint` clean after each chunk.

## Files

- [eslint.config.js](../../eslint.config.js) — primary change
- Many `.ts` / `.tsx` files — boolean renames (count with `yarn lint 2>&1 | grep -c naming-convention`)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing test committed before rule lands
- [ ] ESLint rule added to `eslint.config.js`
- [ ] All boolean naming violations resolved (lint clean)
- [ ] Standard gate: `yarn lint → typecheck → test → e2e → lint` all clean
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Out of scope

- Renaming non-boolean variables (this rule targets `types: ["boolean"]` only)
- Refactoring function signatures beyond renames (e.g., adding new params)
- Changing the prefix set (`is`/`has` only, per AGENTS.md; not adding `should`/`can`/`will`)
