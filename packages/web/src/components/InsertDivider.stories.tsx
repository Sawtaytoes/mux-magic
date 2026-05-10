import type { Meta, StoryObj } from "@storybook/react"
import { action } from "storybook/actions"
import { InsertDivider } from "./InsertDivider"

const meta: Meta<typeof InsertDivider> = {
  title: "Components/InsertDivider",
  component: InsertDivider,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  args: {
    onInsertStep: action("onInsertStep"),
    onInsertSequentialGroup: action(
      "onInsertSequentialGroup",
    ),
    onInsertParallelGroup: action("onInsertParallelGroup"),
    onPaste: action("onPaste"),
  },
}

export default meta
type Story = StoryObj<typeof InsertDivider>

export const Default: Story = {}
