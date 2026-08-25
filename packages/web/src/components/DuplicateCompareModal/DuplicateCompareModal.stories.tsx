import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"

import { DuplicateCompareModal } from "./DuplicateCompareModal"
import {
  type DuplicateCompareModalState,
  duplicateCompareModalAtom,
} from "./duplicateCompareModalAtom"
import {
  buildDuplicateCopy,
  buildDuplicateGroup,
} from "./duplicateFixtures"

// Fixture data only — no story fetches anything, and nothing here names
// a real album.
const buildPayload = (
  groups: DuplicateCompareModalState["groups"],
): DuplicateCompareModalState => ({
  groups,
  jobId: "job-1",
  sourcePath: "/library",
  stepId: "step-1",
})

const identicalAudioPayload = buildPayload([
  buildDuplicateGroup({ groupKey: "audio-1" }),
])

const mixedStrengthPayload = buildPayload([
  buildDuplicateGroup({ groupKey: "audio-1" }),
  buildDuplicateGroup({
    groupKey: "fingerprint-1",
    matchReason: "fingerprint",
  }),
  buildDuplicateGroup({
    groupKey: "tags-1",
    matchReason: "tags",
  }),
])

const higherResolutionPayload = buildPayload([
  {
    copies: [
      buildDuplicateCopy({
        bitDepth: 24,
        filePath:
          "/library/Nova Harbour/Tidewater/01 Slack Water.flac",
        fileSizeBytes: 61_200_000,
        isRecommendedKeep: true,
        rankReasons: [
          "bit depth: 24-bit",
          "sample rate: 96000 Hz",
        ],
        sampleRate: 96_000,
      }),
      buildDuplicateCopy({
        bitDepth: 16,
        filePath:
          "/library/Nova Harbour/Tidewater/01 Slack Water (1).flac",
        fileSizeBytes: 28_400_000,
        sampleRate: 44_100,
      }),
    ],
    groupKey: "resolution-1",
    isDuplicateGroup: true,
    matchReason: "audio",
  },
])

const meta: Meta<typeof DuplicateCompareModal> = {
  title: "Modals/DuplicateCompareModal",
  component: DuplicateCompareModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as DuplicateCompareModalState
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(
          duplicateCompareModalAtom,
          initialState,
        )
        return newStore
      })

      return (
        <Provider store={store}>
          <Story />
        </Provider>
      )
    },
  ],
  parameters: { initialState: identicalAudioPayload },
}
export default meta

type Story = StoryObj<typeof DuplicateCompareModal>

// Identical decoded audio is the only proof, so this is the one match
// strength that starts CHECKED.
export const IdenticalAudio: Story = {
  parameters: { initialState: identicalAudioPayload },
}

// The three strengths side by side. Only the audio group is checked —
// confirming the whole table without reading it cannot move a file on
// the strength of a tag coincidence.
export const MixedMatchStrengths: Story = {
  parameters: { initialState: mixedStrengthPayload },
}

// A ` (N)` copy that is genuinely a copy, at lower resolution. The kept
// row states its reasons so a human can disagree on sight.
export const HigherResolutionWins: Story = {
  parameters: { initialState: higherResolutionPayload },
}

// A clean library. The modal says so rather than showing an empty table.
export const NoDuplicates: Story = {
  parameters: { initialState: buildPayload([]) },
}
