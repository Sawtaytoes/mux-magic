import type { Meta, StoryObj } from "@storybook/react"
import { FIXTURE_COMMANDS_BUNDLE_C } from "../../commands/__fixtures__/commands"
import type { Step } from "../../types"
import { StringArrayField } from "./StringArrayField"

const meta: Meta<typeof StringArrayField> = {
  title: "Fields/StringArrayField",
  component: StringArrayField,
}

export default meta
type Story = StoryObj<typeof StringArrayField>

const field =
  FIXTURE_COMMANDS_BUNDLE_C.deleteFilesByExtension.fields[1]

const mockStep: Step = {
  id: "step-1",
  alias: "",
  command: "deleteFilesByExtension",
  params: { extensions: [".srt", ".idx"] },
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
      placeholder: ".mkv, .mp4",
    },
    step: {
      ...mockStep,
      params: {},
    },
  },
}
