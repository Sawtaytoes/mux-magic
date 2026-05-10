import type { Meta, StoryObj } from "@storybook/react"
import type { Step } from "../../types"
import { BooleanField } from "./BooleanField"

const baseStep: Step = {
  id: "step1",
  alias: "",
  command: "ffmpeg",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof BooleanField> = {
  title: "Components/BooleanField",
  component: BooleanField,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof BooleanField>

export const Unchecked: Story = {
  args: {
    step: { ...baseStep, params: { isRecursive: false } },
    field: {
      name: "isRecursive",
      type: "boolean",
      label: "Recursive",
    },
  },
}

export const Checked: Story = {
  args: {
    step: { ...baseStep, params: { isRecursive: true } },
    field: {
      name: "isRecursive",
      type: "boolean",
      label: "Recursive",
    },
  },
}
