import type { Meta, StoryObj } from "@storybook/react"
import { CollapseChevron } from "./CollapseChevron"

const meta: Meta<typeof CollapseChevron> = {
  title: "Icons/CollapseChevron",
  component: CollapseChevron,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    isCollapsed: { control: "boolean" },
  },
}

export default meta
type Story = StoryObj<typeof CollapseChevron>

export const Expanded: Story = {
  args: { isCollapsed: false },
}

export const Collapsed: Story = {
  args: { isCollapsed: true },
}
