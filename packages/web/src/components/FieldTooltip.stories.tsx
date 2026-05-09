import type { Meta, StoryObj } from "@storybook/react"
import { FieldTooltip } from "./FieldTooltip"

const meta: Meta<typeof FieldTooltip> = {
  title: "Components/FieldTooltip",
  component: FieldTooltip,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof FieldTooltip>

export const WithDescription: Story = {
  args: {
    description: "The base path used as a root for all relative file operations in this sequence.",
    children: <span className="text-xs text-slate-300 cursor-default">Base path</span>,
  },
}

export const NoDescription: Story = {
  args: {
    description: "",
    children: (
      <span className="text-xs text-slate-300 cursor-default">
        No description (hover does nothing)
      </span>
    ),
  },
}
