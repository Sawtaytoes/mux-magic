import type { Meta, StoryObj } from "@storybook/react"
import { StatusBadge } from "./StatusBadge"

const meta: Meta<typeof StatusBadge> = {
  title: "Components/StatusBadge",
  component: StatusBadge,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    status: {
      control: "select",
      options: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
    },
  },
}

export default meta
type Story = StoryObj<typeof StatusBadge>

export const Pending: Story = {
  args: { status: "pending" },
}
export const Running: Story = {
  args: { status: "running" },
}
export const Completed: Story = {
  args: { status: "completed" },
}
export const Failed: Story = { args: { status: "failed" } }
export const Cancelled: Story = {
  args: { status: "cancelled" },
}
export const Unknown: Story = {
  args: { status: "unknown" },
}
