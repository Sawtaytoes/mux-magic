import type { Meta, StoryObj } from "@storybook/react"
import { HomePage } from "./HomePage"

const meta: Meta<typeof HomePage> = {
  title: "Pages/HomePage",
  component: HomePage,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof HomePage>

export const Default: Story = {}

export const Narrow: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
}
