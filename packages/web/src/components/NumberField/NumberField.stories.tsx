import type { Meta, StoryObj } from "@storybook/react"
import type { Step } from "../../types"
import { NumberField } from "./NumberField"

const baseStep: Step = {
  id: "step1",
  alias: "",
  command: "resize",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof NumberField> = {
  title: "Fields/NumberField",
  component: NumberField,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof NumberField>

export const Empty: Story = {
  args: {
    step: baseStep,
    field: {
      name: "width",
      type: "number",
      label: "Width (px)",
      placeholder: "e.g. 1920",
    },
  },
}

export const WithValue: Story = {
  args: {
    step: {
      ...baseStep,
      params: { width: 1920 },
    },
    field: {
      name: "width",
      type: "number",
      label: "Width (px)",
      placeholder: "e.g. 1920",
    },
  },
}

export const WithDefault: Story = {
  args: {
    step: baseStep,
    field: {
      name: "width",
      type: "number",
      label: "Width (px)",
      default: 1080,
    },
  },
}

export const Required: Story = {
  args: {
    step: baseStep,
    field: {
      name: "width",
      type: "number",
      label: "Width (px)",
      required: true,
    },
  },
}
