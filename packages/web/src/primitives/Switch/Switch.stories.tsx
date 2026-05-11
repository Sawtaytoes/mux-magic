import type { Meta, StoryObj } from "@storybook/react"
import { Switch } from "./Switch"

const meta: Meta<typeof Switch> = {
  title: "Components/Switch",
  component: Switch,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    isOn: { control: "boolean" },
    activeTrackClass: { control: "text" },
  },
}

export default meta
type Story = StoryObj<typeof Switch>

export const Off: Story = {
  args: {
    isOn: false,
    activeTrackClass: "bg-emerald-500 border-emerald-400",
  },
}

export const OnEmerald: Story = {
  args: {
    isOn: true,
    activeTrackClass: "bg-emerald-500 border-emerald-400",
  },
}

export const OnAmber: Story = {
  name: "On — amber (dry run)",
  args: {
    isOn: true,
    activeTrackClass: "bg-amber-500 border-amber-400",
  },
}

export const OnRed: Story = {
  name: "On — red (simulate failures)",
  args: {
    isOn: true,
    activeTrackClass: "bg-red-600 border-red-500",
  },
}
