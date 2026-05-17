import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_change_track_languages",
  alias: "Tag Audio Language",
  command: "changeTrackLanguages",
  params: {
    sourcePath: "/mnt/library/show",
    isRecursive: false,
    audioLanguage: "eng",
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Track Operations/changeTrackLanguages",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// All three language codes set — audio + subtitles + video.
export const WithAllLanguages = makeStory({
  ...baseStep,
  id: "step_change_track_languages__all",
  params: {
    ...baseStep.params,
    audioLanguage: "eng",
    subtitlesLanguage: "eng",
    videoLanguage: "und",
  },
})

export const WithRecursive = makeStory({
  ...baseStep,
  id: "step_change_track_languages__recursive",
  params: { ...baseStep.params, isRecursive: true },
})
