import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "cli",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
