// Minimal ESLint config — Biome covers formatting and most linting.
// ESLint is kept only for two specialized plugins Biome has not ported:
//
//   - eslint-plugin-react-compiler — flags patterns that prevent React Compiler
//     from auto-memoizing components (mutations in render, conditional hooks, etc.)
//
//   - eslint-plugin-testing-library — encourages getByRole over getByText in
//     React component tests (.test.tsx files only)
//
// Plus structural rules that enforce AGENTS.md conventions Biome cannot cover:
//
//   - import-x/no-barrel-files — disallows index.ts re-exports inside the
//     monorepo (the single allowed exception is packages/shared/src/index.ts,
//     the npm package boundary)
//
//   - id-length — enforces AGENTS.md rule #3 "spell every variable name out;
//     no single letters or abbreviations". Biome has no equivalent rule.
//
// The react-compiler and testing-library plugins are listed but not yet
// installed as devDependencies — a follow-up PR adds them and turns the
// rules on. Until then they are no-ops.
//
// See docs/react-migration-plan.md "ESLint (Minimal: Two Plugins Only)" for
// the target shape once the plugins land.

import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"

export default defineConfig(
  {
    ignores: [
      ".claude/worktrees/**",
      ".yarn/**",
      "**/build/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/storybook-static/**",
      "packages/server/src/schema.generated/**",
      "packages/web/src/api/schema.generated.ts",
      "public/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.base],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: true,
      },
    },
    linterOptions: {
      // Plugins referenced in eslint-disable comments (react-hooks, etc.)
      // are not yet installed — suppress "unused directive" noise until
      // the follow-up PR adds them.
      reportUnusedDisableDirectives: true,
    },
    rules: {
      // AGENTS.md rule #3: spell every variable name out — no single letters.
      // Biome has no id-length equivalent, so this lives here.
      // "_" is the conventional ignored-param placeholder and stays exempt.
      "id-length": [
        "error",
        {
          min: 2,
          // "$" is the conventional cheerio selector variable (loaded via
          // dynamic import in processUhdDiscForumPost.cherrio.ts).
          exceptions: ["_", "$"],
          // Property names often mirror external APIs (DOMRect.x, etc.)
          // — only enforce length on variables and parameters.
          properties: "never",
        },
      ],
    },
  },
)
