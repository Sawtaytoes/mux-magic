import { defineConfig } from "vitest/config"

// Build-budget test runs in plain node, not browser mode — it spawns
// `vite build` and inspects `dist/`, neither of which works in
// vitest's browser harness. Kept in a separate config so the default
// `yarn test` (browser) skips it; CI invokes this explicitly.
export default defineConfig({
  test: {
    name: "web-build-budget",
    include: ["src/__build-budget__/**/*.test.ts"],
    testTimeout: 180_000,
  },
})
