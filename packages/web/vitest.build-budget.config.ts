import { createVitestConfig } from "@charcuterie/vitest-config"

// Build-budget test runs in plain node, not browser mode — it spawns
// `vite build` and inspects `dist/`, neither of which works in
// vitest's browser harness. Kept in a separate config so the default
// `yarn test` (browser) skips it; CI invokes this explicitly.
//
// A Vitest project does NOT inherit the root config's `test` options,
// so this file calls the factory too. Its own 180s `testTimeout` is a
// measured budget for a real `vite build` and still wins over the
// factory's 30s, because an override is merged last.
export default createVitestConfig({
  test: {
    browser: { enabled: false },
    // The factory turns globals on; this suite has always imported its
    // own `describe`/`test`/`expect` and keeps doing so.
    globals: false,
    name: "web-build-budget",
    include: ["src/__build-budget__/**/*.test.ts"],
    testTimeout: 180_000,
  },
})
