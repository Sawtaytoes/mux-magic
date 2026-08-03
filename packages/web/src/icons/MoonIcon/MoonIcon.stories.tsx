import type { Meta, StoryObj } from "@storybook/react"
import { MoonIcon } from "./MoonIcon"

const meta: Meta<typeof MoonIcon> = {
  title: "Icons/MoonIcon",
  component: MoonIcon,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof MoonIcon>

export const Default: Story = {}
