import type { Meta, StoryObj } from "@storybook/react"
import { DoubleChevron } from "./DoubleChevron"

const meta: Meta<typeof DoubleChevron> = {
  title: "Icons/DoubleChevron",
  component: DoubleChevron,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    isCollapsed: { control: "boolean" },
  },
}

export default meta
type Story = StoryObj<typeof DoubleChevron>

export const Expanded: Story = {
  args: { isCollapsed: false },
}

export const Collapsed: Story = {
  args: { isCollapsed: true },
}
