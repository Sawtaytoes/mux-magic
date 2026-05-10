import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // e2e/ holds Playwright Test specs; they have their own runner (`yarn e2e`)
    // and break under vitest because @playwright/test's describe/test globals
    // aren't compatible.
    exclude: [".claude/worktrees/**", "**/node_modules/**", "**/dist/**", "e2e/**"],
    projects: [
      {
        extends: true,
        // Vite's default publicDir is ./public, which would treat our
        // builder source as static-served-at-root. Disable so the test
        // runner imports the .js modules from their real paths.
        publicDir: false,
        test: {
          name: "browser",
          include: ["**/*.test.{js,ts}"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
      // React component tests for packages/web — uses the web package's own
      // vitest.config.ts which applies the React Compiler babel plugin.
      "packages/server/vitest.config.ts",
      "packages/shared/vitest.config.ts",
      "packages/web/vitest.config.ts",
    ],
  },
})
