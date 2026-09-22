import { createVitestConfig } from "@charcuterie/vitest-config"

export default createVitestConfig({
  test: {
    // A Vitest project does NOT inherit the root config's `test` options,
    // so the shared CI-aware budget only reaches this suite if the project
    // itself calls the factory. See `packages/server/vitest.config.ts` for
    // the measurement.
    browser: { enabled: false },
    // The factory turns globals on; this suite has always imported its
    // own `describe`/`test`/`expect` and keeps doing so.
    globals: false,
    // e2e/ holds Playwright Test specs; they have their own runner (`yarn e2e`)
    // and break under vitest because @playwright/test's describe/test globals
    // aren't compatible.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    name: "server",
    include: ["src/**/*.test.ts"],
    setupFiles: [
      "./vitest.setup.ts",
      "./src/__tests__/setup/msw-server.ts",
    ],
  },
})
