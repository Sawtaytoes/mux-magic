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
    name: "cli",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
