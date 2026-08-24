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
 * `data-scheme` still defaults to `dark` — the scheme Mux Magic opens on — but
 * it is no longer the only one that renders: `SchemeMenuButton` ships the
 * switcher in the app, and this branch moved the last of the hand-rolled slate
 * literals onto tokens, so the toolbar's `light` entry now shows what a user
 * actually gets rather than a half-painted preview.
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
    // No `backgrounds` default on purpose. The addon paints the canvas with a
    // flat literal, which outranks the token-driven `body` rule in
    // `tailwindStyles.css` and the first-paint rule `buildPreviewHead()`
    // injects — so a pinned `"dark"` survives every flip of the `scheme`
    // toolbar, and a `light` story renders light components on a dark canvas.
    // The canvas now comes from `--color-surface-base`, which is the axis.
    docs: {
      theme:
        getPreferredColorScheme() === "dark"
          ? themes.dark
          : themes.light,
    },
  },
}

export default preview
