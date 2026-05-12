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
  decorators: [
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
