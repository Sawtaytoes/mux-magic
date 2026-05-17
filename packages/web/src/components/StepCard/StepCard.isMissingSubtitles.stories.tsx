import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_is_missing_subtitles",
  alias: "Check Missing Subs",
  command: "isMissingSubtitles",
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
    "Components/StepCard/Commands/Subtitle Operations/isMissingSubtitles",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

export const WithRecursive = makeStory({
  ...baseStep,
  id: "step_is_missing_subtitles__recursive",
  params: { ...baseStep.params, isRecursive: true },
})
