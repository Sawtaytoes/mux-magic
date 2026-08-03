import type { Meta, StoryObj } from "@storybook/react"
import { SunIcon } from "./SunIcon"

const meta: Meta<typeof SunIcon> = {
  title: "Icons/SunIcon",
  component: SunIcon,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof SunIcon>

export const Default: Story = {}
