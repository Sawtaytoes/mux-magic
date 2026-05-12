# Worker 07 — one-component-per-file

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/07-one-component-per-file`
**Worktree:** `.claude/worktrees/07_one-component-per-file/`
**Phase:** 1A (serial chain)
**Depends on:** 06
**Parallel with:** none

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

[AGENTS.md](../../AGENTS.md) requires one component per file (already documented as a convention). This worker (1) adds the ESLint rule to enforce it and (2) sweeps existing `.tsx` files that export multiple components, splitting them into separate files.

### ESLint rule

Use `react/no-multi-comp`:

```js
{
  files: ["packages/web/**/*.{ts,tsx}"],
  rules: {
    "react/no-multi-comp": ["error", { ignoreStateless: false }]
  }
}
```

`eslint-plugin-react` may need to be installed if not already present: `yarn add -D eslint-plugin-react eslint-plugin-react-hooks`. Verify before installing — check existing `eslint.config.js` and `package.json#devDependencies`.

### Sweep strategy

After enabling, `yarn lint` reports every multi-component file. For each:
1. Identify the "main" exported component (usually the named default-ish export, or the one consumed externally).
2. Move secondary components to their own `<ComponentName>/<ComponentName>.tsx` file in the same parent directory (or a sibling subdirectory).
3. Update imports across the codebase (grep + Edit).
4. Create matching `.stories.tsx` files for newly-extracted components (per AGENTS.md Storybook convention) — but only if the secondary component is non-trivial (i.e., not a 3-line stub). Trivial stubs can stay merged if you decide they're internal helpers, but they must then be moved into the parent component's same file OR be hoisted to module-internal-only (no JSX-rendered helpers as separate exports).

If a "secondary" component is purely an internal layout helper used in one parent only, an alternative to splitting is to convert it from a component into an inline JSX fragment or a regular function returning JSX called as `<HelperJSX />` IS still a component — that won't satisfy the rule. So either split it out or inline its JSX into the parent.

### Allowed exceptions

`packages/web/src/__fixtures__/**` and `packages/web/src/**/*.stories.tsx` legitimately export multiple components (storybook stories). Configure ESLint to skip these via `files: ["!**/__fixtures__/**", "!**/*.stories.tsx"]` or equivalent override.

## TDD steps

1. Add the ESLint rule.
2. Run `yarn lint` to enumerate violations. Commit a failing-state checkpoint: `chore(eslint): enable react/no-multi-comp; lint failures captured`.
3. Fix violations one logical chunk at a time. Each chunk: rename / split / update imports / `yarn lint` clean for that area.
4. After all fixed: run `yarn typecheck` + `yarn test` + `yarn e2e` to ensure nothing regressed during the splits.

## Files

- [eslint.config.js](../../eslint.config.js)
- Many `.tsx` files — splits + new sibling files

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] ESLint rule added with appropriate exclusions
- [ ] All `react/no-multi-comp` violations fixed (lint clean)
- [ ] Each split file has a matching parent dir + (where applicable) `.stories.tsx` + `.mdx`
- [ ] No broken imports (`yarn typecheck` clean)
- [ ] Standard gate clean
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Out of scope

- Refactoring component logic (this is structural file-splitting only)
- Adding new stories beyond what AGENTS.md mandates for newly-split components
- Enforcing one-component-per-file in non-`packages/web/` packages
