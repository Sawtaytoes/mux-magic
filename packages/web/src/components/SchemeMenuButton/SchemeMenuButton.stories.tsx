import type { Meta, StoryObj } from "@storybook/react"
import { SchemeMenuButton } from "./SchemeMenuButton"

const meta: Meta<typeof SchemeMenuButton> = {
  title: "Components/SchemeMenuButton",
  component: SchemeMenuButton,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
  decorators: [
    (Story) => (
      // Mimic the slate `⋮` popover the row lives in so the story shows
      // it in its real context (dark menu surface, slate foreground).
      <div
        style={{
          background: "rgb(15 23 42)",
          border: "1px solid rgb(51 65 85)",
          borderRadius: "0.5rem",
          padding: "0.75rem",
          minWidth: "14rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SchemeMenuButton>

// Default mode is `system`; click the row to cycle light → dark → system.
export const Default: Story = {}
