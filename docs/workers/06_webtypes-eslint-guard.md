# Worker 06 — webtypes-eslint-guard

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/06-webtypes-eslint-guard`
**Worktree:** `.claude/worktrees/06_webtypes-eslint-guard/`
**Phase:** 1A (serial chain)
**Depends on:** 05 (previous Phase 1A worker)
**Parallel with:** none

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. PID capture. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

PR #74 ("align web types with @mux-magic/server") replaced locally-defined web types with imports from the server's `api-types`. This worker **prevents regression** by adding an ESLint rule blocking new local type aliases that look like server API response shapes.

### Background

Before #74, web defined its own types like `RunStatus`, `CreateJobResponse`, etc. — that drifted silently from the server's contract. The fix was to import from `@mux-magic/server/api-types` instead. Now we need a machine check so a future worker doesn't accidentally re-introduce a local copy.

### Rule design

Use `no-restricted-syntax` to block `interface` and `type` declarations in `packages/web/**` whose names match patterns associated with API shapes:

```js
{
  selector: "TSTypeAliasDeclaration[id.name=/^[A-Z].*(Response|Request|Status|Result|Entry|Payload)$/]",
  message: "API-shape types must be imported from @mux-magic/server/api-types, not defined locally. See PR #74."
},
{
  selector: "TSInterfaceDeclaration[id.name=/^[A-Z].*(Response|Request|Status|Result|Entry|Payload)$/]",
  message: "API-shape interfaces must be imported from @mux-magic/server/api-types, not defined locally. See PR #74."
}
```

Apply only to `packages/web/**` via the `files` config option in `eslint.config.js`. Server and shared can still define these freely.

### Verify pattern set

Read the diff of [PR #74](https://github.com/Sawtaytoes/media-tools/pull/74) (commit `80c552080d25e3f2f525fc0a87a5ca54e50c07ec`) to see exactly which type-name patterns were involved. Adjust the regex if you find others (e.g., names ending in `Job`, `Schema`, etc.).

### Allowlist mechanism

Some legitimate local types may match the pattern. Provide an allowlist via `eslint-disable-next-line` comments + a documented exception list in `eslint.config.js` comments. Don't make the rule overly strict — the goal is to catch obvious regressions, not to be pedantic.

## TDD steps

1. Write a fixture file in `packages/web/src/__eslintFixtures__/localApiShape.tsx` (new) containing `interface CreateJobResponse { ... }`. Add a unit test that runs ESLint on this fixture and asserts the new rule fires. Commit `test(eslint): webtypes guard reports local API-shape types`.
2. Add the rule(s) to `eslint.config.js` scoped to `packages/web/**`.
3. Run `yarn lint` on the existing codebase. Expected: zero violations (since #74 cleaned them up). If any fire, those are real cases that need re-checking — coordinate with user.
4. Verify the test fixture now triggers the rule.

## Files

- [eslint.config.js](../../eslint.config.js)
- `packages/web/src/__eslintFixtures__/localApiShape.tsx` (new fixture)
- `packages/web/src/__eslintFixtures__/localApiShape.test.ts` (new test)

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing fixture-test committed first
- [ ] ESLint rule added; scoped to `packages/web/**`
- [ ] Existing codebase passes (no new violations — verifies #74 was complete)
- [ ] Standard gate clean
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Out of scope

- Renaming or rewriting existing server `api-types` exports
- Adding more API-shape exports (worker 1f or downstream do that as needed)
- Enforcing the same rule in `packages/server/` or `packages/shared/` — those packages legitimately define API shapes
