# Boolean Naming Rename — Worker Prompts

A separate initiative from the React migration recovery. Enforces AGENTS.md rule #4 ("booleans start with `is` or `has`") via ESLint, then renames every violation across the codebase.

## Branch

All work happens on **`feat/boolean-is-has-naming`** (already exists; Haiku started it). The branch has two commits ahead of `react-migration`:

- `b2a0dc0 feat(eslint): enable type-aware parsing with projectService`
- `cff5a2d feat(eslint): add @typescript-eslint/naming-convention for boolean is/has prefix`

The rule is enabled **globally** (every `**/*.{ts,tsx}` file). This means running `yarn lint` against the whole repo will report every existing violation as an error. Workers use **scoped** lint commands so their per-package work has a green gate.

## Two workers, sequenced

| Worker | Scope | Prompt | Status |
|---|---|---|---|
| WBN-A | `packages/server/**` | [WBN-A.md](WBN-A.md) | ✅ Done — 33 files renamed, +174/-156, commits 7ce722d (rule expansion) + f0f0dd5 (renames) |
| WBN-B | `packages/web/**` + `packages/shared/**` | _(generated after react-migration merges to master)_ | ⬜ Deferred until W4 |

WBN-B is held until after react-migration merges to master. Running it now would create endless merge conflicts with W2/W3 churn in `packages/web/**`.

### Lesson from WBN-A — saved as memory `feedback_rename_strategy.md`

ESLint's `@typescript-eslint/naming-convention` fires on the **declaration**, not on references. WBN-A hit a partial-rename bug (`groupFailed` → `hasGroupFailed` renamed at the `let` declaration in `sequenceRunner.ts` but not at the downstream references), causing typecheck failures mid-rename. **Use `Edit` with `replace_all: true` scoped to one file** for local-variable renames. **Grep-then-rename per file** for exported symbols. ESLint catches the next violation after you fix one; it isn't a global rename engine. WBN-B's prompt will bake this in.

## Why the rule is global if the work is staged

Haiku's `cff5a2d` enabled the rule globally for `**/*.{ts,tsx}`. This is intentional — the goal is one shared rule that lives in `eslint.config.js`, not two scoped rules that drift apart. The workaround for incremental work is on the *workflow* side: workers run scoped `eslint` commands for their package, not the global `yarn lint`. The global gate goes green only when WBN-B finishes web.

## Merge strategy

- WBN-A merges its work as commits on `feat/boolean-is-has-naming`.
- After react-migration merges to master, `feat/boolean-is-has-naming` rebases onto master.
- WBN-B does web/shared on the same branch.
- Final PR `feat/boolean-is-has-naming` → master with the rule + all renames.

This single-PR merge means reviewers see "rule enabled" and "all violations fixed" together, which is the right shape for a sweep PR.
