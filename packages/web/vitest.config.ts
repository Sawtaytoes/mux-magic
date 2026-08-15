import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react, {
  reactCompilerPreset,
} from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

import { optimizeDepsInclude } from "./optimizeDeps.js"

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
  /**
   * The list itself lives in `./optimizeDeps.js`, because the CI check
   * that now guards it — `charcuterie-check-optimize-deps` — runs in a
   * plain Node process after the suite and cannot load this TypeScript
   * config. That file carries the full explanation of why the list is
   * load-bearing and how to regenerate it.
   */
  optimizeDeps: { include: [...optimizeDepsInclude] },
})
