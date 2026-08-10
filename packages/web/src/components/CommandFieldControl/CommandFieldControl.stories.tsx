import type { Meta, StoryObj } from "@storybook/react"

import { CommandFieldControl } from "./CommandFieldControl"

const meta: Meta<typeof CommandFieldControl> = {
  title: "Components/CommandFieldControl",
  component: CommandFieldControl,
  parameters: {
    layout: "centered",
  },
}

export default meta
type Story = StoryObj<typeof CommandFieldControl>

const textInput = (
  <input
    className="w-64 bg-surface-raised text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-blue-500"
    type="text"
  />
)

export const Default: Story = {
  args: {
    children: textInput,
    field: { label: "Filename", name: "filename" },
  },
}

export const Required: Story = {
  args: {
    children: textInput,
    field: {
      isRequired: true,
      label: "Filename",
      name: "filename",
    },
  },
}

export const NoLabel: Story = {
  args: {
    children: textInput,
    field: { name: "outputPath" },
  },
}

/**
 * Hover **or focus** the input. `FieldTooltip` opened on pointer only and
 * anchored a `<span>` inside the `<label>`, so a keyboard user could not
 * reach it and nothing referenced it.
 */
export const WithDescription: Story = {
  args: {
    children: textInput,
    field: {
      description:
        "Directory with media files whose tracks need language metadata corrections.",
      label: "Source path",
      name: "sourcePath",
    },
  },
}
