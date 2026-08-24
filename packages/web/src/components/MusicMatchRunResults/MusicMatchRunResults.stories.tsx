import type { Meta, StoryObj } from "@storybook/react"

import type { TagMatchFile } from "../TagMatchModal/tagMatchTypes"
import { MusicMatchRunResults } from "./MusicMatchRunResults"

const buildFile = ({
  confidence,
  filename,
  title,
}: {
  confidence: number
  filename: string
  title: string
}): TagMatchFile => ({
  currentTags: { title, trackNumber: 1 },
  durationSeconds: 210,
  extension: ".flac",
  filePath: `/inbox/${filename}`,
  filename,
  rankedCandidates:
    confidence === 0
      ? []
      : [
          {
            candidate: {
              artistName: "Harbour Lights",
              country: "US",
              format: "CD",
              releaseId: "release-1",
              releaseTitle: "Long Way Down",
              source: "musicbrainz",
              trackCount: 12,
              year: "2004",
            },
            confidence,
            proposedTags: { title, trackNumber: 1 },
          },
        ],
})

const meta: Meta<typeof MusicMatchRunResults> = {
  title: "Components/MusicMatchRunResults",
  component: MusicMatchRunResults,
  parameters: { layout: "padded" },
  args: {
    jobId: "job-1",
    sourcePath: "/inbox/Long Way Down",
    stepId: "step-1",
  },
}
export default meta

type Story = StoryObj<typeof MusicMatchRunResults>

// The ordinary good run. Every file matched, so the panel is one line and
// the trigger.
export const EveryFileMatched: Story = {
  args: {
    files: [
      buildFile({
        confidence: 0.94,
        filename: "01.flac",
        title: "Anchor",
      }),
      buildFile({
        confidence: 0.91,
        filename: "02.flac",
        title: "Bell Buoy",
      }),
    ],
  },
}

// The case the warning block exists for. A bonus track or a hidden track
// often has no release entry, and the user needs to see WHICH file before
// opening the table.
export const SomeFilesUnmatched: Story = {
  args: {
    files: [
      buildFile({
        confidence: 0.94,
        filename: "01.flac",
        title: "Anchor",
      }),
      buildFile({
        confidence: 0,
        filename: "99 - hidden.flac",
        title: "",
      }),
    ],
  },
}

// Nothing matched at all — a folder of untagged rips, or an album
// MusicBrainz has never heard of. The trigger still opens the table,
// because free-hand editing is the answer there.
export const NothingMatched: Story = {
  args: {
    files: [
      buildFile({
        confidence: 0,
        filename: "track1.flac",
        title: "",
      }),
      buildFile({
        confidence: 0,
        filename: "track2.flac",
        title: "",
      }),
    ],
  },
}

// A run whose source folder could not be resolved. The counts still read,
// but there is no absolute path to commit against, so the trigger is gone
// rather than present and broken.
export const NoSourcePath: Story = {
  args: {
    files: [
      buildFile({
        confidence: 0.94,
        filename: "01.flac",
        title: "Anchor",
      }),
    ],
    sourcePath: null,
  },
}
