import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // e2e/ holds Playwright Test specs; they have their own runner (`yarn e2e`)
    // and break under vitest because @playwright/test's describe/test globals
    // aren't compatible.
    exclude: ["**/node_modules/**", "**/dist/**"],
    name: "tools",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
