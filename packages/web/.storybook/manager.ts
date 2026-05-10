import { addons } from "storybook/manager-api"
import {
  getPreferredColorScheme,
  themes,
} from "storybook/theming"

addons.setConfig({
  theme:
    getPreferredColorScheme() === "dark"
      ? themes.dark
      : themes.light,
})
