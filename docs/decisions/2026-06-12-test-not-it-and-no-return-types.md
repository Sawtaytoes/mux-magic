# 2026-06-12 — `test()` not `it()`; no redundant arrow return types

- **Status:** Accepted
- **Date decided:** 2026-06-12
- **Area:** process / core
- **Source:** worker 56 `53bea922` / `b8e69575` (it→test); worker 61 `c9823784` / `0041ae21` (return types)

## Decision

- Tests use `test(...)`, never `it(...)`. Enforced by the ESLint rule `vitest/consistent-test-it` (scoped to test files). Worker 56 swept ~5,000 call sites and added the rule so the regression can't return.
- Arrow functions do **not** carry explicit return-type annotations unless genuinely required: mutual recursion (TS7023), a generic that would otherwise collapse to `unknown`, or the exported `@mux-magic/tools` public API. Let TS infer otherwise. Codified as code-rules rule 10.

## What we rejected — DO NOT revert to this

- Do not add `it(...)` tests "to match the textbook style" — CI fails on it.
- Do not "improve" code by annotating return types everywhere. A stale `: string | null` annotation that outlived a simplified body once forced call sites to handle an impossible `null`. The annotation can silently mis-describe the contract; inference can't.

## Why it must not be re-litigated

Both are lint/CI-enforced project conventions, not stylistic taste. Adding `it()` or blanket return types breaks the pipeline and re-opens sweps that already touched thousands of lines. Full rationale in [docs/agents/code-rules.md](../agents/code-rules.md) and [docs/agents/testing.md](../agents/testing.md).
