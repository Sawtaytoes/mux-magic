# Worker 61 — strip-redundant-return-types

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/61-strip-redundant-return-types`
**Worktree:** `.claude/worktrees/61_strip-redundant-return-types/`
**Phase:** 4
**Depends on:** —
**Parallel with:** any worker that is **not** touching `.ts` / `.tsx` files in the same package you're sweeping. Touch one package at a time (`tools` → `server` → `cli` → `web`) and flip MANIFEST status between packages so other workers can coordinate around your in-flight diff.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Strip explicit arrow-function return-type annotations where the inferred type is identical and the annotation adds no information. Examples of the *bad* pattern this worker removes:

```ts
// Annotation duplicates what TS would infer — remove it.
const stripTrailingSlash = (path: string): string =>
  path.replace(/[\\/]$/u, "")

// Same — inferred return is { ok: boolean; value: string }.
const wrap = (value: string): { ok: boolean; value: string } => ({
  ok: true,
  value,
})
```

After:

```ts
const stripTrailingSlash = (path: string) =>
  path.replace(/[\\/]$/u, "")

const wrap = (value: string) => ({ ok: true, value })
```

**Why this matters (user's reasoning, paraphrased):** an explicit return type can *silently* mask a drift between what the function actually returns and what its callers think it returns. If a downstream change quietly widens the body's return type (e.g. starts returning `string | undefined`), an explicit `: string` will fail at the body (loud) — but for `: string | null` annotations where the body was simplified to always return `string`, the annotation lies to call sites about the possibility of `null`, forcing them to handle a case that can't happen. Letting TS infer keeps the contract honest both directions.

The user's stated preference: **avoid manually typing the return value unless required**.

### When the annotation IS required — keep it

Don't remove annotations in these cases (most produce a TS error if you try; this list lets you skip them during the sweep instead of round-tripping through tsc):

1. **Mutual recursion** — when function A calls function B and B calls A, TS can't infer either. Annotate one (typically the "entry point") to break the cycle. TS error: `TS7023: '<name>' implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.` Leave a one-line comment explaining the cycle so the next reader knows the annotation is load-bearing. Example landed in [packages/web/src/state/runAtoms.ts](../../packages/web/src/state/runAtoms.ts) — search for "mutual-recursion inference cycle".
2. **Direct self-recursion** — same diagnostic, same fix.
3. **Public API surface where you want the type to be the contract** — e.g. exported helpers in `packages/tools/src/` whose return shape is part of the published API. Inference is fine for internal helpers; for the npm-published surface, an explicit type pins the contract.
4. **Generic functions where inference produces a useless type** — e.g. `<T>(items: T[]) => items.reduce(...)` where the reducer initial value collapses inference to `unknown`. If removing the annotation widens the type to something callers can't use, restore it.
5. **Discriminated unions you specifically want narrowed** — sometimes inference picks `string | number` when you want a tighter literal union. If the explicit type is *narrower* than the inferred one, keep it (TS will complain at the body if the annotation is too narrow, so this case is self-policing).
6. **`async` functions where the call site needs the inner type for `.then` chaining clarity** — rare; usually only matters in long promise pipelines.

### When you're not sure — round-trip through tsc

1. Remove the annotation.
2. Run `yarn typecheck` from the package root.
3. If clean → leave it removed.
4. If TS7023 / TS7022 / a downstream error appears → restore the annotation and move on. Don't try to refactor callers to accommodate a stripped annotation; that's scope creep.

## TDD steps

There's no test for "no redundant return types" — the verification is `yarn typecheck` and `yarn test` after each package. Treat each package as one TDD cycle:

1. **Pick a package.** Start with [packages/tools](../../packages/tools) (smallest surface). Then [packages/cli](../../packages/cli), then [packages/server](../../packages/server), then [packages/web](../../packages/web).
2. **Find candidates.** Within the package, run:

   ```bash
   grep -rnE "\): [A-Za-z_][A-Za-z0-9_<>|&\[\]{}, \?]*\s*=>" --include="*.ts" --include="*.tsx" packages/<name>/src/ | head -50
   ```

   This catches `): SomeType =>` and `): Foo | null =>` shapes on arrow functions. It's a starting set — not exhaustive. Multi-line signatures like:

   ```ts
   const fn = (
     arg: string,
   ): SomeType => { ... }
   ```

   need a separate sweep:

   ```bash
   grep -rnE "^\s*\):\s+" --include="*.ts" --include="*.tsx" packages/<name>/src/
   ```

3. **Strip + verify in batches of ~10–20 files.** Per file:
   - Use the Edit tool to remove the `: ReturnType` portion (leave the parameter list and `=>` intact).
   - After a batch: `yarn typecheck`. Clean → continue. Errors → revert the file(s) that triggered them (the error message names the file + line) and move on.
4. **Run package tests after each batch:** `yarn workspace @mux-magic/<package> test`. Behavior must not change — this is a syntactic-only sweep.
5. **Commit per package** with the focused message `refactor(<package>): strip redundant arrow-function return types`. Don't combine packages into one mega-commit — review burden is too high.
6. **Cross-link from code-rules.md.** After the last package, edit [docs/agents/code-rules.md](../agents/code-rules.md) — add a new rule (slot it in numerically; the file's "All Nine Rules" section will become "All Ten Rules") that reads:

   > **No explicit return types on arrow functions unless required.** Let TS infer. Explicit annotations are required only for mutual / self recursion (TS7023), generics whose inference collapses to `unknown`, and exported `packages/tools` helpers that form the npm-published API. Otherwise the annotation duplicates what TS would infer AND can silently mis-describe the contract if the body later changes.

   Also add a row to the "Before Opening a PR — Self-Check Your Diff" table:

   | Search for | Means you violated |
   |---|---|
   | `\): [A-Za-z_][A-Za-z0-9_<>|&\[\]{}, \?]*\s*=>` in non-recursive, non-exported code added in your diff | the new rule above (use inference) |

   Update [AGENTS.md](../../AGENTS.md) `## The Five Most-Violated Rules` only if early-adopter agents keep violating this — initial rollout, leave AGENTS.md alone.
7. **Standard gate.** `yarn lint → typecheck → test → e2e → lint` from root after every package commit.
8. **Manifest.** Dedicated `chore(manifest):` flip commits for `in-progress` (at start) and `done` (after merge).

## Files

- All `packages/**/src/**/*.{ts,tsx}` — sweep candidates, by package.
- [docs/agents/code-rules.md](../agents/code-rules.md) — new rule + self-check table entry (final commit only).
- **NOT** [docs/agents/architecture.md](../agents/architecture.md) — this is a code style rule, not an architecture concern.

## Out of scope

- **Type-import cleanups** (`import type { ... }`). Different convention; separate worker if needed.
- **Removing variable-declaration types** (`const foo: string = "x"`). `@typescript-eslint/no-inferrable-types` already covers that.
- **Function-declaration return types** (`function foo(): string {}`). The repo bans `function` declarations per [code-rules.md rule 7](../agents/code-rules.md), so there shouldn't be any to sweep.
- **Refactoring callers** when a stripped annotation widens a return type. If inference makes the type broader than the explicit one, restore the annotation rather than chasing callers. That's a different worker's concern.
- **Tests directories** (`*.test.{ts,tsx}`). Test helper signatures are scoped tightly enough that the convention matters less; focus on `src/`.
- **e2e specs** (`e2e/*.spec.ts`). Same reasoning.
- **`packages/tools/src/index.ts`** and any directly-exported helpers in `packages/tools/src/` that form the npm `@mux-magic/tools` public surface. Keep return-type annotations on those.

## Verification checklist

- [ ] Worktree created; MANIFEST row → `in-progress` in its own `chore(manifest):` commit
- [ ] Per-package sweep commits land in order: `tools` → `cli` → `server` → `web`
- [ ] Each per-package commit passes `yarn typecheck` + `yarn workspace @mux-magic/<pkg> test` standalone
- [ ] Annotations preserved on mutual-recursion entry points, generic edge cases, and `@mux-magic/tools` published surface — each preserved annotation has a one-line comment explaining *why*
- [ ] [docs/agents/code-rules.md](../agents/code-rules.md) updated with the new rule + self-check table row
- [ ] Standard gate clean (`lint → typecheck → test → e2e → lint`)
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] [docs/workers/MANIFEST.md](MANIFEST.md) row updated to `done`
