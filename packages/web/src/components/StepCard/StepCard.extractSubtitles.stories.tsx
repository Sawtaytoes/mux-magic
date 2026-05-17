import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_extract_subtitles",
  alias: "Extract Subtitles",
  command: "extractSubtitles",
  params: {
    sourcePath: "/mnt/library/show",
    isRecursive: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Subtitle Operations/extractSubtitles",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Single language filter — extract only English subtitles.
export const WithEnglishOnly = makeStory({
  ...baseStep,
  id: "step_extract_subtitles__eng",
  params: { ...baseStep.params, subtitlesLanguage: "eng" },
})

// Japanese language filter — exercises a non-ASCII-name language.
export const WithJapaneseOnly = makeStory({
  ...baseStep,
  id: "step_extract_subtitles__jpn",
  params: { ...baseStep.params, subtitlesLanguage: "jpn" },
})

export const WithRecursive = makeStory({
  ...baseStep,
  id: "step_extract_subtitles__recursive",
  params: { ...baseStep.params, isRecursive: true },
})
