import type { Meta, StoryObj } from "@storybook/react"
import { MonitorIcon } from "./MonitorIcon"

const meta: Meta<typeof MonitorIcon> = {
  title: "Icons/MonitorIcon",
  component: MonitorIcon,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof MonitorIcon>

export const Default: Story = {}
