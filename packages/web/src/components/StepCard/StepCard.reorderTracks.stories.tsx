import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_reorder_tracks",
  alias: "Reorder Tracks",
  command: "reorderTracks",
  params: {
    sourcePath: "/mnt/library/show",
    isRecursive: false,
    videoTrackIndexes: [0],
    audioTrackIndexes: [1, 0],
    subtitlesTrackIndexes: [0],
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Track Operations/reorderTracks",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Multi-track audio reorder — swap two audio tracks to make the second
// the default (some encoders default the first track regardless of
// language).
export const WithAudioReorder = makeStory({
  ...baseStep,
  id: "step_reorder_tracks__audio_only",
  params: {
    ...baseStep.params,
    audioTrackIndexes: [1, 0, 2],
    subtitlesTrackIndexes: [],
  },
})

// Recursive — applies the same reorder across a folder tree.
export const WithRecursive = makeStory({
  ...baseStep,
  id: "step_reorder_tracks__recursive",
  params: { ...baseStep.params, isRecursive: true },
})
