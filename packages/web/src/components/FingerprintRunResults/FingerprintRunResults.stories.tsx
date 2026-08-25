import type { Meta, StoryObj } from "@storybook/react"
import { FingerprintRunResults } from "./FingerprintRunResults"
import { buildFingerprintMatch } from "./fingerprintFixtures"

const meta: Meta<typeof FingerprintRunResults> = {
  title: "Components/FingerprintRunResults",
  component: FingerprintRunResults,
  parameters: { layout: "padded" },
}
export default meta

type Story = StoryObj<typeof FingerprintRunResults>

// Every file identified AND linked to a MusicBrainz recording, so every
// one of them is worth contributing back.
export const EveryFileContributable: Story = {
  args: {
    matches: [
      buildFingerprintMatch({
        filename: "01 Slack Water.flac",
      }),
      buildFingerprintMatch({
        filename: "02 Spring Tide.flac",
      }),
    ],
  },
}

// AcoustID knows the audio but nobody has tied it to MusicBrainz. A
// fingerprint sent with no recording id adds an entry linked to nothing,
// so those rows are counted and not submitted.
export const SomeWithoutRecordings: Story = {
  args: {
    matches: [
      buildFingerprintMatch({
        filename: "01 Slack Water.flac",
      }),
      buildFingerprintMatch({
        filename: "02 Spring Tide.flac",
        hasRecording: false,
      }),
    ],
  },
}

// Nothing to contribute, so the button is withheld rather than offering
// a public database write that would carry no information.
export const NothingContributable: Story = {
  args: {
    matches: [
      buildFingerprintMatch({ hasRecording: false }),
    ],
  },
}

// A run that identified nothing renders nothing at all.
export const NoMatches: Story = {
  args: { matches: [] },
}
