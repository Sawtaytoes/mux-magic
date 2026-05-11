import type { Meta, StoryObj } from "@storybook/react"
import { FIXTURE_COMMANDS_BUNDLE_B } from "../../commands/__fixtures__/commands"
import type { Step } from "../../types"
import { LanguageCodesField } from "./LanguageCodesField"

const meta = {
  title: "Fields/LanguageCodesField",
  component: LanguageCodesField,
  tags: ["autodocs"],
} satisfies Meta<typeof LanguageCodesField>

export default meta
type Story = StoryObj<typeof meta>

const mockStep = (overrides?: Partial<Step>): Step => ({
  id: "step-1",
  alias: "",
  command: "keepLanguages",
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
      FIXTURE_COMMANDS_BUNDLE_B.keepLanguages.fields[1],
  },
}

export const WithMultipleCodes: Story = {
  args: {
    step: mockStep({
      params: { audioLanguages: ["eng", "jpn"] },
    }),
    field:
      FIXTURE_COMMANDS_BUNDLE_B.keepLanguages.fields[1],
  },
}

export const WithSingleCode: Story = {
  args: {
    step: mockStep({
      params: { audioLanguages: ["eng"] },
    }),
    field:
      FIXTURE_COMMANDS_BUNDLE_B.keepLanguages.fields[1],
  },
}
