import type { Meta, StoryObj } from "@storybook/react"
import { FIXTURE_COMMANDS_BUNDLE_B } from "../../commands/__fixtures__/commands"
import type { Step } from "../../types"
import { LanguageCodeField } from "./LanguageCodeField"

const meta = {
  component: LanguageCodeField,
  tags: ["autodocs"],
} satisfies Meta<typeof LanguageCodeField>

export default meta
type Story = StoryObj<typeof meta>

const mockStep = (overrides?: Partial<Step>): Step => ({
  id: "step-1",
  alias: "",
  command: "changeTrackLanguages",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

export const Empty: Story = {
  args: {
    step: mockStep(),
    field:
      FIXTURE_COMMANDS_BUNDLE_B.changeTrackLanguages
        .fields[1],
  },
}

export const WithValue: Story = {
  args: {
    step: mockStep({
      params: { audioLanguage: "jpn" },
    }),
    field:
      FIXTURE_COMMANDS_BUNDLE_B.changeTrackLanguages
        .fields[1],
  },
}
