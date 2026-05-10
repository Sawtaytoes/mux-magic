import { join } from "node:path"
import babel from "@rolldown/plugin-babel"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import tailwindcss from "@tailwindcss/vite"
import react, {
  reactCompilerPreset,
} from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "web",
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: join(
              import.meta.dirname,
              ".storybook",
            ),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
      {
        extends: true,
        plugins: [
          react(),
          babel({
            presets: [
              reactCompilerPreset({ target: "19" }),
            ],
          }),
          tailwindcss(),
        ],
        test: {
          name: "web",
          include: ["src/**/*.test.{ts,tsx}"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        // Vite's default publicDir is ./public, which would treat our
        // builder source as static-served-at-root. Disable so the test
        // runner imports the .js modules from their real paths.
        publicDir: false,
        test: {
          name: "browser",
          include: ["public/**/*.test.{js,ts}"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
})
