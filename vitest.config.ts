import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // e2e/ holds Playwright Test specs; they have their own runner (`yarn e2e`)
    // and break under vitest because @playwright/test's describe/test globals
    // aren't compatible.
    exclude: [".claude/worktrees/**", "**/node_modules/**", "**/dist/**", "e2e/**"],
    projects: [
      "packages/server/vitest.config.ts",
      "packages/shared/vitest.config.ts",
      "packages/web/vitest.config.ts",
    ],
  },
})
