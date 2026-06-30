# 2026-06-29 — The CI/lint-enforced conventions are locked too

- **Status:** Accepted (pointer record)
- **Date decided:** 2026-06-29 (recorded; the underlying conventions are older and standing)
- **Area:** process
- **Source:** this catch-up pass; the linked reference docs are the source of truth

## Decision

A set of conventions is already enforced by ESLint / Biome / CI and documented under [docs/agents/](../agents/). They are **locked decisions too** — this record exists so the decision log points at them rather than duplicating them. Do not "modernize" or revert these; CI will reject them, and they were chosen deliberately:

- **Code style** ([code-rules.md](../agents/code-rules.md)): no `for`/`for...of`/`while` over arrays; `const` only; no array/object mutation (`.push`/`.splice`/in-place sort) — prefer `xs.concat(item)` over `[...xs, item]`; booleans start with `is`/`has`; spell names out (no single letters / abbreviations); single destructured object param at 2+ args; always-braced conditionals; const arrow functions with implicit returns; no barrel files except the published `@mux-magic/tools` entry; no redundant arrow return-type annotations.
- **Testing** ([testing.md](../agents/testing.md), [test-interactions.md](../agents/test-interactions.md)): `test()` not `it()`; **no snapshot / screenshot / VRT tests** — inline expected values; failing-test-first; `.toBeVisible()` over `.toBeInTheDocument()`; `packages/web` runs in **real Chromium** (don't add jsdom polyfills); keep `"test": "vitest"` (watch) and put `run` only in CI.
- **Architecture** ([architecture.md](../agents/architecture.md)): Observable-first command modules; `process.exit()` only in `cli.ts`; pure state updates (no direct property mutation); `makeDirectory(path)` creates the exact path (caller passes `dirname`); commands accept `malId`/`tvdbId` to bypass deprecated stdin prompts.
- **Tooling/infra**: **yarn only**, never npm/npx ([code in workflows.md / package-manager](../agents/workflows.md)); install new deps at `@latest`; on Windows never bulk-edit with `Get-Content`/`Set-Content` (UTF-8 mojibake) — use the Edit tool or `[System.IO.File]::ReadAllText/WriteAllText` ([powershell-windows.md](../agents/powershell-windows.md)); no personal filesystem paths in committed files; rename by blast radius (grep all references for exported symbols before replacing).

## What we rejected — DO NOT revert to this

Do not treat "CI is green-ish / lint auto-fixed it" as license to write `for` loops, `.push`, `it(...)`, snapshot tests, `npm install`, or `function` declarations "because they're standard." Each has a project-specific reason and a lint rule behind it. The lint suggestion to "fix" a spread into `.push` is itself a trap — do not take it (see no-array-mutation).

## Why it must not be re-litigated

These are the rules agents break most often precisely because they are the universal defaults of the wider ecosystem. CI enforcement catches most, but catching it at review wastes a round-trip — internalize them up front. The full, authoritative details live in the linked docs.
