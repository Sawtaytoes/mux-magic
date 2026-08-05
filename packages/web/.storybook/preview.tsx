import {
  installThemeAxes,
  themeParameters,
} from "@charcuterie/storybook-config/preview"
import type { Decorator } from "@storybook/react"
import { createStore } from "jotai"
import { useState } from "react"
import {
  getPreferredColorScheme,
  themes,
} from "storybook/theming"

import { AppProviders } from "../src/components/AppProviders"
import "../src/styles/tailwindStyles.css"
import "../src/styles/builderStyles.css"

/**
 * All three token axes, written onto the preview iframe's `<html>` by the
 * shared writer — the same mechanism `index.html` uses in the app.
 *
 * This replaces three separate pieces mux-magic used to carry: the
 * `@storybook/addon-themes` scheme toggle, a hand-written decorator that pinned
 * `data-variant` and echoed `data-density`, and a local `density` `globalType`.
 * `data-scheme` still defaults to `dark` (Mux Magic ships dark-only); the
 * `light` and non-daylight entries are here so those renderings can be looked
 * at before the app grows a toggle.
 */
const themeAxes = installThemeAxes([
  "density",
  "variant",
  "scheme",
])

/** The app's providers, innermost, so the theme is on `<html>` first. */
const withAppProviders: Decorator = (Story) => {
  const [store] = useState(() => createStore())

  return (
    <AppProviders store={store}>
      <Story />
    </AppProviders>
  )
}

export const globalTypes = themeAxes.globalTypes

const preview = {
  initialGlobals: themeAxes.initialGlobals,
  decorators: [...themeAxes.decorators, withAppProviders],
  parameters: {
    ...themeParameters(),
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
