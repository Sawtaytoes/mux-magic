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
  optimizeDeps: {
    include: [
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
