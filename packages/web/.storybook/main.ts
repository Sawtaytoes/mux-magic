import {
  buildPreviewHead,
  docsAddonWithGfm,
} from "@charcuterie/storybook-config"
import babel from "@rolldown/plugin-babel"
import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"
import { reactCompilerPreset } from "@vitejs/plugin-react"
import { mergeConfig } from "vite"
import { mockServerPlugin } from "./mock-server-plugin.ts"

const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.{ts,tsx}",
    "../src/**/*.mdx",
  ],
  addons: [
    // Was "@storybook/addon-docs" + a separate `options.mdxPluginOptions`
    // spread; `docsAddonWithGfm` carries the GFM plugin config.
    docsAddonWithGfm,
    "@storybook/addon-a11y",
    // `@storybook/addon-themes` is gone: it wrote `data-scheme` from a
    // decorator's `useEffect` so it could not theme a story-less page, and it
    // meant scheme went through the addon while density/variant went through
    // hand-written decorators. The shared `installThemeAxes` in preview.tsx now
    // drives all three axes through one writer.
    "@storybook/addon-vitest",
  ],
  core: {
    disableTelemetry: true,
  },
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // The token first-paint `<style>` + the axis-seed `<script>`, from the shared
  // package — the piece mux-magic never had, so a cold-loaded story on the
  // composed site painted stock Storybook white. See
  // `charcuterie/docs/how-we-do-storybook.md`.
  previewHead: buildPreviewHead(),
  // Apply the same Vite plugins the web package uses so stories compile with
  // the React Compiler (auto-memoization) and Tailwind v4. Bespoke (React
  // Compiler + the mock server), so it stays here rather than using
  // `charcuterieViteFinal`.
  viteFinal: async (storybookViteConfig) =>
    mergeConfig(storybookViteConfig, {
      plugins: [
        babel({
          presets: [reactCompilerPreset({ target: "19" })],
        }),
        tailwindcss(),
        mockServerPlugin(),
      ],
    }),
}

export default config
