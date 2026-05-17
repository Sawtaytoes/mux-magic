import type { Meta, StoryObj } from "@storybook/react"
import { FIXTURE_COMMANDS_BUNDLE_C } from "../../commands/__fixtures__/commands"
import type { Step } from "../../types"
import { NumberArrayField } from "./NumberArrayField"

const meta: Meta<typeof NumberArrayField> = {
  title: "Fields/NumberArrayField",
  component: NumberArrayField,
}

export default meta
type Story = StoryObj<typeof NumberArrayField>

const field =
  FIXTURE_COMMANDS_BUNDLE_C.addSubtitles.fields[1]

const mockStep: Step = {
  id: "step-1",
  alias: "",
  command: "addSubtitles",
  params: { offsets: [0, -200, 150] },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

export const Empty: Story = {
  args: {
    field,
    step: {
      ...mockStep,
      params: {},
    },
  },
}

export const WithValues: Story = {
  args: {
    field,
    step: mockStep,
  },
}

export const WithPlaceholder: Story = {
  args: {
    field: {
      ...field,
      placeholder: "100, 200, 300",
    },
    step: {
      ...mockStep,
      params: {},
    },
  },
}
