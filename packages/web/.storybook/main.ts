import babel from "@rolldown/plugin-babel"
import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"
import { reactCompilerPreset } from "@vitejs/plugin-react"
import remarkGfm from "remark-gfm"
import { mergeConfig } from "vite"
import { mockServerPlugin } from "./mock-server-plugin.ts"

const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.{ts,tsx}",
    "../src/**/*.mdx",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
  ],
  core: {
    disableTelemetry: true,
  },
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // Apply the same Vite plugins the web package uses so stories compile with
  // the React Compiler (auto-memoization) and Tailwind v4.
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

// `options.mdxPluginOptions` is read by @storybook/addon-docs' MDX vite plugin
// via presets.apply("options"). StorybookConfig doesn't type this key, so we
// spread config (typed) and add options separately in the export.
export default {
  ...config,
  options: {
    mdxPluginOptions: {
      mdxCompileOptions: {
        remarkPlugins: [remarkGfm],
      },
    },
  },
}
