import { join } from "node:path"
import { createVitestConfig } from "@charcuterie/vitest-config"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"

/*
 * A Vitest project does NOT inherit the root config's `test` options, so
 * the shared CI-aware budget only reaches this suite if the project
 * itself calls the factory. See `packages/server/vitest.config.ts` for
 * the measurement.
 *
 * The factory also supplies the chromium-through-Playwright browser
 * block this file used to spell out. It is not repeated here: Vite's
 * `mergeConfig` CONCATENATES arrays, so naming `instances` again would
 * ask for two chromium instances and run every story twice.
 */
export default createVitestConfig({
  plugins: [
    storybookTest({
      configDir: join(import.meta.dirname, ".storybook"),
    }),
  ],
  test: {
    name: "storybook",
    /*
     * ⚠️ No `setupFiles` here. `@storybook/addon-vitest` injects its
     * own, and naming one in this config REPLACES it — every story
     * then fails to import with "Vitest failed to find the runner".
     * The CI-aware `asyncUtilTimeout` is applied in the `web`
     * project, which is where the evidence for it is.
     */
    // The factory turns globals on; this suite has always imported its
    // own `describe`/`test`/`expect` and keeps doing so.
    globals: false,
    // The Storybook vitest plugin takes its file list from `stories` in
    // .storybook/main.ts, which includes the 54 `.mdx` documentation
    // pages alongside the 124 story files. An `.mdx` page holds no
    // stories to render, so every one of them was collected and then
    // reported as a skipped test file — 54 skips that never meant
    // anything was going untested. Documentation is not a test; drop it
    // from the run rather than leave the number to be re-investigated.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.mdx",
    ],
  },
  // Mirror the include list from vitest.config.ts. Storybook tests render
  // the same React components and hit the same React-compiler-runtime path,
  // so the cold-cache reload race applies here too. See the long comment
  // in vitest.config.ts for the full reasoning.
  //
  // ⚠️ This list is hand-maintained and HAS DRIFTED — `optimizeDeps.js` also
  // carries the `@charcuterie/*` entries and this one does not. There is no
  // parity check on this project, so the drift is invisible until a cold CI
  // run loses the coin flip. It did on 2026-09-02: adding
  // `@charcuterie/ui/react-router` to `AppRouter` made this optimizer
  // discover it mid-suite, and three story files failed to import with
  // "Vitest failed to find the current suite" — the reload signature.
  optimizeDeps: {
    include: [
      "@charcuterie/ui/react-router",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@hono/zod-openapi",
      "@tanstack/react-query",
      "@testing-library/jest-dom/vitest",
      "@testing-library/react",
      "@testing-library/user-event",
      "jotai",
      "jotai/utils",
      "js-yaml",
      "react",
      "react-dom",
      "react-dom/client",
      "react-router",
      "react/compiler-runtime",
      "react/jsx-dev-runtime",
      "react/jsx-runtime",
    ],
  },
})
