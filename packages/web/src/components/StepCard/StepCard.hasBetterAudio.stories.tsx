import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_has_better_audio",
  alias: "Find Better Audio",
  command: "hasBetterAudio",
  params: {
    sourcePath: "/mnt/library/music",
    isRecursive: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Analysis/hasBetterAudio",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

export const WithRecursiveDepth = makeStory({
  ...baseStep,
  id: "step_has_better_audio__recursive",
  params: {
    ...baseStep.params,
    isRecursive: true,
    recursiveDepth: 2,
  },
})
