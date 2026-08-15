import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react, {
  reactCompilerPreset,
} from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset({ target: "19" })],
    }),
    tailwindcss(),
  ],
  test: {
    name: "web",
    include: ["src/**/*.test.{ts,tsx}"],
    // __build-budget__ runs in node mode (spawns `vite build`, reads
    // dist/) — owned by `vitest.build-budget.config.ts`.
    exclude: [
      "**/node_modules/**",
      "src/__build-budget__/**",
    ],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
    setupFiles: ["./vitest.setup.ts"],
  },
  // Pre-declare every browser-mode test dep so Vite optimizes them all at
  // startup. Without this list, Vite discovers deps as tests run, kicks off
  // a re-optimization, and reloads the page mid-test — which nukes React's
  // compiler-runtime cache and triggers `useMemoCache` null errors. The
  // race is invisible after the first run locally (Vite caches the result
  // in node_modules/.vite) but reproduces on every CI run, which has no
  // warm cache. Source of truth: `node_modules/.vite/vitest/.../deps/_metadata.json`
  // after a successful run — this list mirrors every top-level entry there.
  optimizeDeps: {
    include: [
      "@charcuterie/logic",
      "@charcuterie/logic/browser",
      // Every subpath is its OWN optimizer entry — `@charcuterie/logic`
      // being listed does not cover `/query` or `/openapi`. Both were
      // missing until 2026-08-15 (as was `@charcuterie/ui`), and the race
      // they opened is exactly the one this comment describes: it lost the
      // coin flip on a CI runner and 16 tests failed with `Failed to fetch
      // dynamically imported module: .../react_jsx-dev-runtime.js?v=…`,
      // the re-optimization signature.
      "@charcuterie/logic/openapi",
      "@charcuterie/logic/query",
      "@charcuterie/ui",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@hono/zod-openapi",
      // Pulled in by Vitest itself rather than by app source, but it is a
      // top-level entry in `_metadata.json` all the same, and this list is
      // defined as mirroring that file. (The `vitest > …` rows there are
      // Vite's naming for transitive deps, not entries — they stay out.)
      "expect-type",
      "@tanstack/react-query",
      "@testing-library/jest-dom/vitest",
      "@testing-library/react",
      "@testing-library/user-event",
      "jotai",
      "jotai/utils",
      "js-yaml",
      "react",
      "react-dom",
      "react-dom/client",
      "react-router",
      "react/compiler-runtime",
      "react/jsx-dev-runtime",
      "react/jsx-runtime",
    ],
  },
})
