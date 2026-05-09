import type { Preview } from "@storybook/react";
import { Provider as JotaiProvider } from "jotai";
import { initialize as initMsw, mswLoader } from "msw-storybook-addon";
import "../packages/web/src/styles/tailwindStyles.css";
import "../packages/web/src/styles/builderStyles.css";

// Start MSW in the Storybook iframe — handlers declared per-story via
// the `msw` parameter. No-op when no handlers are configured.
initMsw();

const preview: Preview = {
  loaders: [mswLoader],
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
      values: [
        { name: "dark", value: "#0f172a" }, // slate-900
        { name: "light", value: "#f8fafc" }, // slate-50
      ],
    },
  },
};

export default preview;
