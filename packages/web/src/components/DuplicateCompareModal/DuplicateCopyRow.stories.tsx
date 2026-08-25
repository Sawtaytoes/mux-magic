import type { Meta, StoryObj } from "@storybook/react"

import { DuplicateCopyRow } from "./DuplicateCopyRow"
import { buildDuplicateCopy } from "./duplicateFixtures"

const meta: Meta<typeof DuplicateCopyRow> = {
  title: "Components/DuplicateCopyRow",
  component: DuplicateCopyRow,
  parameters: { layout: "padded" },
  args: {
    isReadOnly: false,
    onPlay: () => {},
    onSelectKeep: () => {},
  },
}
export default meta

type Story = StoryObj<typeof DuplicateCopyRow>

export const Kept: Story = {
  args: {
    copy: buildDuplicateCopy({
      bitDepth: 16,
      filePath:
        "/library/Nova Harbour/Tidewater/01 Slack Water.flac",
      fileSizeBytes: 28_400_000,
      isRecommendedKeep: true,
      sampleRate: 44_100,
    }),
    isKept: true,
  },
}

export const MovedOut: Story = {
  args: {
    copy: buildDuplicateCopy({
      filePath:
        "/library/Nova Harbour/Tidewater/01 Slack Water.mp3",
      fileSizeBytes: 8_100_000,
    }),
    isKept: false,
  },
}

// After a confirmed move the row is frozen, so a second click cannot
// re-submit a file that is already out of the library.
export const ReadOnly: Story = {
  args: {
    copy: buildDuplicateCopy({
      filePath:
        "/library/Nova Harbour/Tidewater/01 Slack Water.mp3",
      fileSizeBytes: 8_100_000,
    }),
    isKept: false,
    isReadOnly: true,
  },
}
