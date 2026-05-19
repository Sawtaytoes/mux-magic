import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

// DEPRECATED alias for extractSubtitles. Stories exist so the
// deprecation banner / picker entry remains visible in Storybook for QA.
const baseStep: Step = {
  id: "step_copy_out_subtitles",
  alias: "Extract Subtitles (deprecated)",
  command: "copyOutSubtitles",
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
    "Components/StepCard/Commands/Subtitle Operations/copyOutSubtitles",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

export const WithLanguageFilter = makeStory({
  ...baseStep,
  id: "step_copy_out_subtitles__lang",
  params: {
    ...baseStep.params,
    subtitlesLanguages: ["eng"],
  },
})

export const WithRecursive = makeStory({
  ...baseStep,
  id: "step_copy_out_subtitles__recursive",
  params: { ...baseStep.params, isRecursive: true },
})
