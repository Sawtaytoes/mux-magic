import type { Preview } from "@storybook/react";
import { Provider as JotaiProvider } from "jotai";
import { getPreferredColorScheme, themes } from "storybook/theming";
import "../packages/web/src/styles/tailwindStyles.css";
import "../packages/web/src/styles/builderStyles.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      // Global fallback Provider with the default store. Story-level decorators
      // that pass a custom store take precedence (inner Provider wins in React).
      <JotaiProvider>
        <Story />
      </JotaiProvider>
    ),
  ],
  parameters: {
    backgrounds: {
      default: "dark",
      // values: [
      //   { name: "dark", value: "#0f172a" }, // slate-900
      //   { name: "light", value: "#f8fafc" }, // no light mode yet
      // ],
    },
    docs: {
      theme: getPreferredColorScheme() === "dark" ? themes.dark : themes.light,
    },
  },
};

export default preview;
