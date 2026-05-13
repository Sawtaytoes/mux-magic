import type { Meta, StoryObj } from "@storybook/react"
import { FieldLabel } from "./FieldLabel"

const meta: Meta<typeof FieldLabel> = {
  title: "Components/FieldLabel",
  component: FieldLabel,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof FieldLabel>

export const Default: Story = {
  args: {
    command: "ffmpeg",
    field: { name: "filename", label: "Filename" },
  },
}

export const Required: Story = {
  args: {
    command: "ffmpeg",
    field: {
      name: "filename",
      label: "Filename",
      isRequired: true,
    },
  },
}

export const NoLabel: Story = {
  args: {
    command: "ffmpeg",
    field: { name: "outputPath" },
  },
}
