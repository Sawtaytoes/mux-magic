// Minimal ESLint config — Biome covers formatting and most linting.
// ESLint is kept only for structural rules Biome cannot express, and those now
// come from `@charcuterie/eslint-config`: `id-length`, the `is`/`has` boolean
// naming convention, one-component-per-file, `test()`-not-`it()`, and the
// logical-properties rule. mux-magic was the app those rules were derived from,
// so this is the same enforcement arriving from the shared package instead of a
// local copy — with only the mux-magic-shaped block (API-shape types) left here.
//
// Still-planned plugins, unchanged by this:
//
//   - eslint-plugin-react-compiler — flags patterns that prevent React Compiler
//     from auto-memoizing components (mutations in render, conditional hooks, etc.)
//
//   - eslint-plugin-testing-library — encourages getByRole over getByText in
//     React component tests (.test.tsx files only)
//
// See docs/react-migration-plan.md "ESLint (Minimal: Two Plugins Only)" for
// the target shape once the plugins land.

import {
  COMPONENT_CHOICE_NAMESPACE,
  componentChoicePlugin,
  createReactRules,
  createStoryOverrides,
  createTestRules,
  createTypedRules,
  PHYSICAL_DIRECTION_SELECTORS,
} from "@charcuterie/eslint-config"
import { defineConfig } from "eslint/config"

// PR #74 aligned web types with @mux-magic/api/api-types. These selectors
// block re-introducing local copies of API-shape types in packages/web.
//
// Allowlist: add `// eslint-disable-next-line no-restricted-syntax -- <reason>`
// above the declaration for any legitimate local type that matches the pattern.
// Documented exceptions (all carry eslint-disable-next-line at the declaration site):
//   ApplyIfEntry (DslRulesBuilder/types.ts)         — DSL builder map-entry; not an API shape
//   LookupSearchResult (LookupModal/types.ts)        — web-only normalized union of per-provider fields
//   AnySearchResponse (LookupSearchStage.tsx)        — file-local union of imported server types
//   LogStreamDonePayload (useLogStream.ts)           — type alias for JobLogDoneEvent (already imported)
//   LoadYamlResult (loadYaml.ts)                     — return type of a YAML parsing utility
//   FlatEntry (sequenceUtils.ts)                     — UI helper for flattening the step tree
//   ConnectionStatus (jobsConnectionAtom.ts)         — frontend SSE connection state
//   LogEntry (logsByJobIdAtom.ts)                    — Jotai atom element type
const WEB_API_SHAPE_RULES = [
  {
    selector:
      "TSTypeAliasDeclaration[id.name=/^[A-Z].*(Response|Request|Status|Result|Entry|Payload|Job|Schema)$/]",
    message:
      "API-shape types must be imported from @mux-magic/api/api-types, not defined locally. See PR #74.",
  },
  {
    selector:
      "TSInterfaceDeclaration[id.name=/^[A-Z].*(Response|Request|Status|Result|Entry|Payload|Job|Schema)$/]",
    message:
      "API-shape interfaces must be imported from @mux-magic/api/api-types, not defined locally. See PR #74.",
  },
]

// Core moves, renames, deletes, and writes media only through
// packages/core/src/tools/guardedFileWrites.ts, which checks every path
// against the allowed file roots, including paths a command builds while
// it runs. This rule keeps a new command from writing past that check.
// The app's own state files (job records, caches, the transcode temp
// store) live outside the media roots, so they are listed in `ignores`.
// See docs/decisions/2026-11-14-core-writes-check-every-path-against-the-allowed-roots.md.
const GUARDED_WRITE_MESSAGE =
  "Import this write from packages/core/src/tools/guardedFileWrites.ts, which checks the path against the allowed file roots."
const FILE_SYSTEM_PROMISE_WRITE_NAMES = [
  "appendFile",
  "copyFile",
  "cp",
  "link",
  "mkdir",
  "rename",
  "rm",
  "rmdir",
  "symlink",
  "truncate",
  "unlink",
  "utimes",
  "writeFile",
]
const FILE_SYSTEM_SYNC_WRITE_NAMES =
  FILE_SYSTEM_PROMISE_WRITE_NAMES.map(
    (name) => `${name}Sync`,
  ).concat(["createWriteStream"])
const TOOLS_WRITE_NAMES = [
  "aclSafeCopyFile",
  "aclSafeCopyFolder",
  "createRenameFileOrFolderObservable",
  "makeDirectory",
  "renameFileOrFolder",
  "renameOntoDestination",
]
const CORE_GUARDED_WRITE_RESTRICTIONS = [
  ["node:fs/promises", FILE_SYSTEM_PROMISE_WRITE_NAMES],
  ["fs/promises", FILE_SYSTEM_PROMISE_WRITE_NAMES],
  [
    "node:fs",
    FILE_SYSTEM_SYNC_WRITE_NAMES.concat(
      FILE_SYSTEM_PROMISE_WRITE_NAMES,
    ),
  ],
  [
    "fs",
    FILE_SYSTEM_SYNC_WRITE_NAMES.concat(
      FILE_SYSTEM_PROMISE_WRITE_NAMES,
    ),
  ],
  ["@mux-magic/tools", TOOLS_WRITE_NAMES],
].map(([name, importNames]) => ({
  importNames,
  message: GUARDED_WRITE_MESSAGE,
  name,
}))

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
      "docs/**",
      "examples/**",
      "packages/core/src/schema.generated/**",
      "packages/web/src/api/schema.generated.ts",
    ],
  },
  createTypedRules({
    tsconfigRootDir: import.meta.dirname,
  }),
  {
    // Two things share this rule, and they have to be declared together:
    // ESLint *replaces* a rule's options rather than merging them, so a second
    // `no-restricted-syntax` block covering these same files would silently
    // drop the first one's selectors. That is why this does not call
    // `createLogicalPropertiesRules()` — it spreads the shared selectors in.
    //
    //   - API-shape types: guard against re-introducing local copies in
    //     packages/web. Server and tools packages legitimately define these;
    //     only web must import them.
    //   - Logical properties: the shared fleet rule (no `marginLeft` /
    //     `paddingRight` / `left` in shipped component markup).
    files: ["packages/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...WEB_API_SHAPE_RULES,
        ...PHYSICAL_DIRECTION_SELECTORS,
      ],
    },
  },
  {
    files: ["packages/core/src/**/*.ts"],
    ignores: [
      "**/*.test.ts",
      "**/__fixtures__/**",
      "packages/core/src/api/jobErrorStore.ts",
      "packages/core/src/api/jobPersistence.ts",
      "packages/core/src/music/fixtures/**",
      "packages/core/src/tools/animeOfflineDatabase.ts",
      "packages/core/src/tools/transcodeTempStore.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: CORE_GUARDED_WRITE_RESTRICTIONS },
      ],
    },
  },
  // AGENTS.md convention: one component per file in packages/web.
  createReactRules({
    files: ["packages/web/**/*.{ts,tsx}"],
  }),
  // Every picker is a `Listbox` — in practice `Picker`, which is a
  // `Listbox` with its trigger attached — and never a native `Select`
  // or a raw `<select>`. See docs/agents/code-rules.md "Pickers" and
  // docs/decisions/2026-08-20-every-picker-is-a-listbox-never-a-native-select.md.
  //
  // These two rules are registered by name rather than through
  // `createComponentChoiceRules()`, which would also turn on
  // `no-raw-anchor`, `no-raw-button`, `no-clickable-non-interactive`
  // and `no-navigation-in-click-handler`. Each of those is a real
  // sweep this app has not done, and a config that turns a repo red is
  // one that gets reverted rather than migrated — they are their own
  // change.
  //
  // Both rules already ship in the pinned `@charcuterie/eslint-config`,
  // so this is config-only: no dependency bump, no lockfile change.
  {
    files: ["packages/web/**/*.tsx"],
    plugins: {
      [COMPONENT_CHOICE_NAMESPACE]: componentChoicePlugin,
    },
    rules: {
      [`${COMPONENT_CHOICE_NAMESPACE}/no-raw-select`]:
        "error",
      [`${COMPONENT_CHOICE_NAMESPACE}/prefer-listbox-over-select`]:
        "error",
    },
  },
  createStoryOverrides({
    files: [
      "packages/web/**/__fixtures__/**/*.{ts,tsx}",
      "packages/web/**/*.stories.tsx",
      "packages/web/**/*.storyHelpers.tsx",
    ],
  }),
  // `test()`, not `it()`. Scoped to *.test.{ts,tsx} — e2e Playwright specs use
  // a different `test` namespace and are intentionally excluded.
  createTestRules({
    files: ["**/*.test.{ts,tsx}"],
  }),
)
