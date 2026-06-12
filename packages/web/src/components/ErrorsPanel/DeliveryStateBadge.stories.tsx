import type { Meta, StoryObj } from "@storybook/react"
import { DeliveryStateBadge } from "./DeliveryStateBadge"

const meta: Meta<typeof DeliveryStateBadge> = {
  title: "Components/DeliveryStateBadge",
  component: DeliveryStateBadge,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof DeliveryStateBadge>

export const Pending: Story = {
  args: { state: "pending" },
}

export const Delivered: Story = {
  args: { state: "delivered" },
}

export const Exhausted: Story = {
  args: { state: "exhausted" },
}
