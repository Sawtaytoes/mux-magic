import type { Meta, StoryObj } from "@storybook/react"
import { ToolCard } from "./ToolCard"

const sampleIcon = (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6 text-sky-400"
  >
    <rect x="3" y="4" width="7" height="6" rx="1.5" />
    <rect x="14" y="14" width="7" height="6" rx="1.5" />
    <path d="M10 7h3.5a2 2 0 0 1 2 2v5" />
  </svg>
)

const meta: Meta<typeof ToolCard> = {
  title: "Components/ToolCard",
  component: ToolCard,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ToolCard>

export const Default: Story = {
  args: {
    href: "/builder",
    icon: sampleIcon,
    title: "Builder",
    description:
      "Compose a sequence of media commands — remux, rename, merge subtitles — and run it locally or on the server.",
  },
}

export const ShortDescription: Story = {
  args: {
    href: "/jobs",
    icon: sampleIcon,
    title: "Jobs",
    description: "Watch running and finished jobs.",
  },
}

export const WithoutIcon: Story = {
  args: {
    href: "/errors",
    icon: null,
    title: "Errors",
    description:
      "Inspect failures that need a redelivery decision.",
  },
}
