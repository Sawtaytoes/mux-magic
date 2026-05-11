import type { Meta, StoryObj } from "@storybook/react"

import { FIXTURE_COMMANDS_BUNDLE_D } from "../../commands/__fixtures__/commands"
import { NumberWithLookupField } from "./NumberWithLookupField"

const meta: Meta<typeof NumberWithLookupField> = {
  title: "Fields/NumberWithLookupField",
  component: NumberWithLookupField,
}

export default meta
type Story = StoryObj<typeof NumberWithLookupField>

const field =
  FIXTURE_COMMANDS_BUNDLE_D.nameAnimeEpisodes.fields[1]

export const Empty: Story = {
  args: {
    field,
    step: {
      id: "example-1",
      alias: "",
      command: "nameAnimeEpisodes",
      params: { malId: "", malName: "" },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}

export const WithValue: Story = {
  args: {
    field,
    step: {
      id: "example-2",
      alias: "",
      command: "nameAnimeEpisodes",
      params: { malId: 5114 },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}

export const WithCompanionName: Story = {
  args: {
    field,
    step: {
      id: "example-3",
      alias: "",
      command: "nameAnimeEpisodes",
      params: {
        malId: 5114,
        malName: "Fullmetal Alchemist",
      },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}
