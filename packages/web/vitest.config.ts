import { createVitestConfig } from "@charcuterie/vitest-config"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react, {
  reactCompilerPreset,
} from "@vitejs/plugin-react"

import { optimizeDepsInclude } from "./optimizeDeps.js"

/*
 * A Vitest project does NOT inherit the root config's `test` options, so
 * the shared CI-aware budget only reaches this suite if the project
 * itself calls the factory. See `packages/server/vitest.config.ts` for
 * the measurement.
 *
 * The factory also supplies the chromium-through-Playwright browser
 * block this file used to spell out. It is not repeated here: Vite's
 * `mergeConfig` CONCATENATES arrays, so naming `instances` again would
 * ask for two chromium instances and run the whole suite twice.
 */
export default createVitestConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset({ target: "19" })],
    }),
    tailwindcss(),
  ],
  test: {
    // The factory turns globals on; this suite has always imported its
    // own `describe`/`test`/`expect` and keeps doing so.
    globals: false,
    name: "web",
    include: ["src/**/*.test.{ts,tsx}"],
    // __build-budget__ runs in node mode (spawns `vite build`, reads
    // dist/) — owned by `vitest.build-budget.config.ts`.
    exclude: [
      "**/node_modules/**",
      "src/__build-budget__/**",
    ],
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
