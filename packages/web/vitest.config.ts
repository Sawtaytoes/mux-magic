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
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@hono/zod-openapi",
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
