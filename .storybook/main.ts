import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: [
    "../packages/web/src/**/*.stories.{ts,tsx}",
    "../packages/web/src/**/*.mdx",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // Apply the same Vite plugins the web package uses so stories compile with
  // the React Compiler (auto-memoization) and Tailwind v4.
  viteFinal: async (storybookViteConfig) =>
    mergeConfig(storybookViteConfig, {
      plugins: [
        react({
          babel: {
            plugins: [["babel-plugin-react-compiler", { target: "19" }]],
          },
        }),
        tailwindcss(),
      ],
    }),
};

export default config;
