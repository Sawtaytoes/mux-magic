// Minimal ESLint config — Biome covers formatting and most linting.
// ESLint is kept only for two specialized plugins Biome has not ported:
//
//   - eslint-plugin-react-compiler — flags patterns that prevent React Compiler
//     from auto-memoizing components (mutations in render, conditional hooks, etc.)
//
//   - eslint-plugin-testing-library — encourages getByRole over getByText in
//     React component tests (.test.tsx files only)
//
// Plus one structural rule that enforces AGENTS.md "no barrel files" rule:
//
//   - import-x/no-barrel-files — disallows index.ts re-exports inside the
//     monorepo (the single allowed exception is packages/shared/src/index.ts,
//     the npm package boundary)
//
// PR #1 ships the config skeleton only. The plugins are listed but not yet
// installed as devDependencies — a follow-up PR adds them and turns the rules
// on. Until then, ESLint runs with no rules and immediately exits 0.
//
// See docs/react-migration-plan.md "ESLint (Minimal: Two Plugins Only)" for
// the target shape once the plugins land.

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      ".yarn/**",
      "packages/web/src/api/schema.generated.ts",
      "packages/server/src/schema.generated/**",
    ],
  },
]
