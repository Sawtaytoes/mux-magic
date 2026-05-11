# Boolean Naming Rename — Worker Prompts

A separate initiative from the React migration recovery. Enforces AGENTS.md rule #4 ("booleans start with `is` or `has`") via ESLint, then renames every violation across the codebase.

## Branch

All work happens on **`feat/boolean-is-has-naming`** (already exists; Haiku started it). The branch has two commits ahead of `react-migration`:

- `b2a0dc0 feat(eslint): enable type-aware parsing with projectService`
- `cff5a2d feat(eslint): add @typescript-eslint/naming-convention for boolean is/has prefix`

The rule is enabled **globally** (every `**/*.{ts,tsx}` file). This means running `yarn lint` against the whole repo will report every existing violation as an error. Workers use **scoped** lint commands so their per-package work has a green gate.

## Two workers, sequenced

| Worker | Scope | Prompt | Start when |
|---|---|---|---|
| WBN-A | `packages/server/**` | [WBN-A.md](WBN-A.md) | Now — server is untouched by React migration |
| WBN-B | `packages/web/**` + `packages/shared/**` | _(generated after WBN-A reports AND react-migration merges to master)_ | After W4 (react-migration → master) |

WBN-B waits because `packages/web/**` is under active churn from W2A–W2D. Renaming web booleans during that window creates endless merge conflicts. After react-migration merges to master, the rebase-and-rename pass is safe.

## Why the rule is global if the work is staged

Haiku's `cff5a2d` enabled the rule globally for `**/*.{ts,tsx}`. This is intentional — the goal is one shared rule that lives in `eslint.config.js`, not two scoped rules that drift apart. The workaround for incremental work is on the *workflow* side: workers run scoped `eslint` commands for their package, not the global `yarn lint`. The global gate goes green only when WBN-B finishes web.

## Merge strategy

- WBN-A merges its work as commits on `feat/boolean-is-has-naming`.
- After react-migration merges to master, `feat/boolean-is-has-naming` rebases onto master.
- WBN-B does web/shared on the same branch.
- Final PR `feat/boolean-is-has-naming` → master with the rule + all renames.

This single-PR merge means reviewers see "rule enabled" and "all violations fixed" together, which is the right shape for a sweep PR.
