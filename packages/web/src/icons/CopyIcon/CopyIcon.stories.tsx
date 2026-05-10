import type { Meta, StoryObj } from "@storybook/react"
import { CopyIcon } from "./CopyIcon"

const meta: Meta<typeof CopyIcon> = {
  title: "Icons/CopyIcon",
  component: CopyIcon,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof CopyIcon>

export const Default: Story = {}
