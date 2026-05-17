import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_has_imax_audio",
  alias: "Find IMAX Audio",
  command: "hasImaxEnhancedAudio",
  params: {
    sourcePath: "/mnt/library/movies",
    isRecursive: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Analysis/hasImaxEnhancedAudio",
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
  id: "step_has_imax_audio__recursive",
  params: { ...baseStep.params, isRecursive: true },
})
