import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_replace_tracks",
  alias: "Replace Tracks",
  command: "replaceTracks",
  params: {
    sourcePath: "/mnt/source/show",
    destinationFilesPath: "/mnt/destination/show",
    hasChapterSyncOffset: false,
    includeChapters: false,
    audioLanguages: ["eng"],
    subtitlesLanguages: [],
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Track Operations/replaceTracks",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Multi-language replacement — audio + subtitles + video lists.
export const WithMultipleLanguages = makeStory({
  ...baseStep,
  id: "step_replace_tracks__multi_lang",
  params: {
    ...baseStep.params,
    audioLanguages: ["eng", "jpn"],
    subtitlesLanguages: ["eng", "spa"],
    videoLanguages: ["und"],
  },
})

// Per-file offsets — common when audio replacements drift across
// episodes.
export const WithPerFileOffsets = makeStory({
  ...baseStep,
  id: "step_replace_tracks__offsets",
  params: { ...baseStep.params, offsets: [0, -150, 200] },
})

// Chapter-sync offset enabled — extends offset behavior across
// chapter markers.
export const WithChapterSyncOffset = makeStory({
  ...baseStep,
  id: "step_replace_tracks__chapter_sync",
  params: {
    ...baseStep.params,
    hasChapterSyncOffset: true,
    includeChapters: true,
    globalOffset: -100,
  },
})
