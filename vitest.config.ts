import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"

// Two-project setup (vitest v4 dropped defineWorkspace; the workspace
// file moves inline here under test.projects):
//
//   - "node":    existing server-side / pure-logic tests under src/.
//                Inherits the memfs setup so any fs-touching code keeps
//                a clean in-memory volume.
//
//   - "browser": ES module component tests under public/builder/js/.
//                Runs in a real Chromium via @vitest/browser + Playwright
//                provider — gives us actual DOM/event semantics with no
//                jsdom in the dep tree. Skips the node-only memfs setup.
export default defineConfig({
  test: {
    // e2e/ holds Playwright Test specs; they have their own runner (`yarn e2e`)
    // and break under vitest because @playwright/test's describe/test globals
    // aren't compatible.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["src/**/*.test.ts"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        // Vite's default publicDir is ./public, which would treat our
        // builder source as static-served-at-root. Disable so the test
        // runner imports the .js modules from their real paths.
        publicDir: false,
        test: {
          name: "browser",
          include: ["public/**/*.test.{js,ts}"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
})
