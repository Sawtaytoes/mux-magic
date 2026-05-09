import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "vitest"
import { InsertDivider } from "./InsertDivider"

const meta: Meta<typeof InsertDivider> = {
  title: "Components/InsertDivider",
  component: InsertDivider,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  args: {
    onInsertStep: fn(),
    onInsertSequentialGroup: fn(),
    onInsertParallelGroup: fn(),
    onPaste: fn(),
  },
}

export default meta
type Story = StoryObj<typeof InsertDivider>

export const Default: Story = {}
