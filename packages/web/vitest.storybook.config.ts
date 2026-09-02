import { join } from "node:path"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    storybookTest({
      configDir: join(import.meta.dirname, ".storybook"),
    }),
  ],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
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
