import { withThemeByDataAttribute } from "@storybook/addon-themes"
import type { Preview } from "@storybook/react"
import { createStore } from "jotai"
import { useState } from "react"
import {
  getPreferredColorScheme,
  themes,
} from "storybook/theming"

import { AppProviders } from "../src/components/AppProviders"
import "../src/styles/tailwindStyles.css"
import "../src/styles/builderStyles.css"

const preview: Preview = {
  /**
   * The three token axes, written straight onto the preview iframe's
   * `<html>` — the same mechanism `index.html` uses in the app, exercised
   * rather than simulated.
   *
   * It is not decoration. `@charcuterie/tokens` scopes every `--color-*`
   * under `[data-scheme="light"]` or `[data-scheme="dark"]`, so a story
   * canvas with no attribute has **no colour variables at all** and every
   * `@charcuterie/ui` component renders transparent — with a green build, a
   * green typecheck, and a screenshot that looks like a styling opinion
   * rather than a missing attribute.
   *
   * `dark` by default because Mux Magic ships dark-only; the toolbar's
   * `light` entry is here so a component's light rendering can be looked at
   * before the app ever grows a toggle.
   */
  globalTypes: {
    density: {
      description:
        "Control sizing and type scale. Composes with scheme.",
      toolbar: {
        dynamicTitle: true,
        icon: "component",
        items: [
          { title: "Comfortable", value: "comfortable" },
          { title: "Compact", value: "compact" },
          { title: "Kiosk", value: "kiosk" },
        ],
        title: "Density",
      },
    },
  },
  initialGlobals: {
    density: "comfortable",
  },
  decorators: [
    withThemeByDataAttribute({
      attributeName: "data-scheme",
      defaultTheme: "dark",
      themes: {
        dark: "dark",
        light: "light",
      },
    }),
    (Story, context) => {
      document.documentElement.setAttribute(
        "data-variant",
        "daylight",
      )

      document.documentElement.setAttribute(
        "data-density",
        String(context.globals.density),
      )

      return <Story />
    },
    (Story) => {
      const [store] = useState(() => createStore())
      return (
        <AppProviders store={store}>
          <Story />
        </AppProviders>
      )
    },
  ],
  parameters: {
    actions: {
      expandLevel: 0,
    },
    backgrounds: {
      default: "dark",
    },
    docs: {
      theme:
        getPreferredColorScheme() === "dark"
          ? themes.dark
          : themes.light,
    },
  },
}

export default preview
