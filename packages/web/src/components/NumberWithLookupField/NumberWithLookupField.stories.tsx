import type { Meta, StoryObj } from "@storybook/react"

import { FIXTURE_COMMANDS_BUNDLE_D } from "../../commands/__fixtures__/commands"
import { NumberWithLookupField } from "./NumberWithLookupField"

const meta: Meta<typeof NumberWithLookupField> = {
  title: "Fields/NumberWithLookupField",
  component: NumberWithLookupField,
}

export default meta
type Story = StoryObj<typeof NumberWithLookupField>

const idLookupField =
  FIXTURE_COMMANDS_BUNDLE_D.nameAnimeEpisodes.fields[1]

const numericField = {
  ...idLookupField,
  name: "episodeCount",
  label: "Episode Count",
  lookupType: undefined,
  companionNameField: undefined,
  hasIncrementButtons: true,
}

export const IdLookupEmpty: Story = {
  args: {
    field: idLookupField,
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

export const IdLookupWithValue: Story = {
  args: {
    field: idLookupField,
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

export const IdLookupWithCompanionName: Story = {
  args: {
    field: idLookupField,
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

export const NumericWithCustomButtons: Story = {
  args: {
    field: numericField,
    step: {
      id: "example-4",
      alias: "",
      command: "nameAnimeEpisodes",
      params: { episodeCount: 12 },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}

export const NumericEmpty: Story = {
  args: {
    field: numericField,
    step: {
      id: "example-5",
      alias: "",
      command: "nameAnimeEpisodes",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  },
}
