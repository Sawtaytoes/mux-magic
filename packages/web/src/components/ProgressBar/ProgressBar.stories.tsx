import type { Meta, StoryObj } from "@storybook/react"
import { ProgressBar } from "../ProgressBar/ProgressBar"

const meta: Meta<typeof ProgressBar> = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof ProgressBar>

export const Determinate: Story = {
  args: {
    snapshot: {
      ratio: 0.62,
      filesDone: 6,
      filesTotal: 10,
      bytesPerSecond: 5_000_000,
      bytesRemaining: 38_000_000,
    },
  },
}

export const Indeterminate: Story = {
  args: { snapshot: {} },
}

export const WithPerFileRows: Story = {
  args: {
    snapshot: {
      ratio: 0.4,
      filesDone: 2,
      filesTotal: 5,
      currentFiles: [
        { path: "/media/movies/Inception.mkv", ratio: 0.7 },
        { path: "/media/movies/Dune.mkv", ratio: 0.1 },
      ],
    },
  },
}

export const Complete: Story = {
  args: {
    snapshot: { ratio: 1, filesDone: 10, filesTotal: 10 },
  },
}
