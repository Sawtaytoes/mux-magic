import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    name: "core",
    include: ["src/**/*.test.ts"],
    setupFiles: [
      "./vitest.setup.ts",
      "./src/__tests__/setup/msw-server.ts",
    ],
  },
})
