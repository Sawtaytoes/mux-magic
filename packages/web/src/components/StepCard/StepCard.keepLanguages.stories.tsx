import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_keep_languages",
  alias: "Filter Languages",
  command: "keepLanguages",
  params: {
    sourcePath: "/mnt/library/show",
    isRecursive: false,
    audioLanguages: ["eng", "jpn"],
    subtitlesLanguages: ["eng"],
    useFirstAudioLanguage: false,
    useFirstSubtitlesLanguage: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Track Operations/keepLanguages",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Multiple audio languages — exercises the languageCodes chip layout.
export const WithMultipleAudioLanguages = makeStory({
  ...baseStep,
  id: "step_keep_languages__multi_audio",
  params: {
    ...baseStep.params,
    audioLanguages: ["eng", "jpn", "spa", "fre"],
  },
})

// First-audio shortcut — the "First Audio Only" boolean overrides the
// audioLanguages list. Shows the two-col field group.
export const WithFirstAudioOnly = makeStory({
  ...baseStep,
  id: "step_keep_languages__first_audio",
  params: {
    ...baseStep.params,
    audioLanguages: [],
    useFirstAudioLanguage: true,
  },
})

// Subtitles language set to a single code — minimal subtitles config.
export const WithSingleSubtitleLanguage = makeStory({
  ...baseStep,
  id: "step_keep_languages__single_sub",
  params: {
    ...baseStep.params,
    subtitlesLanguages: ["eng"],
  },
})

// Empty language lists — placeholder/empty-state rendering.
export const WithEmptyLanguageLists = makeStory({
  ...baseStep,
  id: "step_keep_languages__empty",
  params: {
    ...baseStep.params,
    audioLanguages: [],
    subtitlesLanguages: [],
  },
})

export const WithRecursive = makeStory({
  ...baseStep,
  id: "step_keep_languages__recursive",
  params: { ...baseStep.params, isRecursive: true },
})
