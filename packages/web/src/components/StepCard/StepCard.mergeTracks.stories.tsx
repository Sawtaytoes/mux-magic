import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

// DEPRECATED alias for addSubtitles. Stories exist so the deprecation
// banner / picker entry remains visible in Storybook for QA — production
// users see the same "renamed to addSubtitles" note here.
const baseStep: Step = {
  id: "step_merge_tracks",
  alias: "Merge Subtitle Tracks (deprecated)",
  command: "mergeTracks",
  params: {
    sourcePath: "/mnt/incoming",
    subtitlesPath: "/mnt/subtitles",
    hasChapterSyncOffset: false,
    includeChapters: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Track Operations/mergeTracks",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

export const WithGlobalOffset = makeStory({
  ...baseStep,
  id: "step_merge_tracks__global_offset",
  params: { ...baseStep.params, globalOffset: -150 },
})

export const WithPerFileOffsets = makeStory({
  ...baseStep,
  id: "step_merge_tracks__per_file_offsets",
  params: { ...baseStep.params, offsets: [0, -200, 150] },
})
