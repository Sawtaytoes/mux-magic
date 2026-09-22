import { createVitestConfig } from "@charcuterie/vitest-config"

export default createVitestConfig({
  test: {
    // A Vitest project does NOT inherit the root config's `test` options,
    // so the shared CI-aware budget only reaches this suite if the project
    // itself calls the factory. Measured 2026-09-22: with `CI=true` a test
    // here still timed out at 5.01s, Vitest's off-CI default, while the
    // root config had been on the factory for a release.
    browser: { enabled: false },
    /*
     * The factory turns globals on. This suite has always run without
     * them and every file imports `describe`, `test` and `expect` from
     * `vitest` already, so keep that rather than gaining a second way to
     * reach the same names.
     */
    globals: false,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    name: "server-front-door",
    include: ["src/**/*.test.ts"],
  },
})
