import type { Meta, StoryObj } from "@storybook/react"
import { FIXTURE_COMMANDS_BUNDLE_B } from "../../commands/__fixtures__/commands"
import type { Step } from "../../types"
import { EnumField } from "./EnumField"

const meta = {
  component: EnumField,
  tags: ["autodocs"],
} satisfies Meta<typeof EnumField>

export default meta
type Story = StoryObj<typeof meta>

const mockStep = (overrides?: Partial<Step>): Step => ({
  id: "step-1",
  alias: "",
  command: "nameAnimeEpisodesAniDB",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

export const WithDefaultValue: Story = {
  args: {
    step: mockStep(),
    field:
      FIXTURE_COMMANDS_BUNDLE_B.nameAnimeEpisodesAniDB
        .fields[2],
  },
}

export const WithSelectedValue: Story = {
  args: {
    step: mockStep({
      params: { episodeType: "specials" },
    }),
    field:
      FIXTURE_COMMANDS_BUNDLE_B.nameAnimeEpisodesAniDB
        .fields[2],
  },
}
