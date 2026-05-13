import type { Meta, StoryObj } from "@storybook/react"
import type { Step } from "../../types"
import { StringField } from "./StringField"

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

const meta: Meta<typeof StringField> = {
  title: "Fields/StringField",
  component: StringField,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof StringField>

export const Empty: Story = {
  args: {
    step: baseStep,
    field: {
      name: "filename",
      type: "string",
      label: "Filename",
      placeholder: "e.g. output.mp4",
    },
  },
}

export const WithValue: Story = {
  args: {
    step: {
      ...baseStep,
      params: { filename: "my-video.mp4" },
    },
    field: {
      name: "filename",
      type: "string",
      label: "Filename",
      placeholder: "e.g. output.mp4",
    },
  },
}

export const Required: Story = {
  args: {
    step: baseStep,
    field: {
      name: "filename",
      type: "string",
      label: "Filename",
      isRequired: true,
    },
  },
}
