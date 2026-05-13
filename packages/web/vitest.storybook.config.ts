import { join } from "node:path"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    storybookTest({
      configDir: join(import.meta.dirname, ".storybook"),
    }),
  ],
  test: {
    name: `storybook:${join(import.meta.dirname, ".storybook")}`,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
})
