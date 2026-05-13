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

// AGENTS.md rule #4: booleans start with `is` or `has`.
// Enforced here because @typescript-eslint/naming-convention uses TypeScript
// type information (types: ["boolean"]) which Biome cannot access.
//
// Selector rationale: we use "typeProperty" and "classProperty" rather than
// the broader "property" to avoid flagging object literal properties that are
// external API contracts (yargs option configs, DOM EventInit, etc.) which we
// cannot rename. "variable" and "parameter" cover all local/module declarations.
const IS_HAS_BOOLEAN_RULE = {
  selector: [
    "variable",
    "parameter",
    "typeProperty",
    "classProperty",
  ],
  types: ["boolean"],
  format: null,
  prefix: ["is", "has"],
  // Allow underscore-prefixed names (_ ignore-placeholder, __dirname, etc.)
  filter: { regex: "^(__|_)", match: false },
}

export default defineConfig(
  {
    ignores: [
      ".claude/worktrees/**",
      ".playwright-mcp/**",
      ".yarn/**",
      "**/build/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/public/**",
      "**/scripts/**",
      "**/storybook-static/**",
      "examples/**",
      "packages/server/src/schema.generated/**",
      "packages/web/src/api/schema.generated.ts",
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
      // AGENTS.md rule #4: booleans start with `is` or `has`.
      "@typescript-eslint/naming-convention": [
        "error",
        IS_HAS_BOOLEAN_RULE,
      ],
    },
  },
)
