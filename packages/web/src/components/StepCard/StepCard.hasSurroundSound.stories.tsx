import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_has_surround_sound",
  alias: "Find Surround Audio",
  command: "hasSurroundSound",
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
    "Components/StepCard/Commands/Analysis/hasSurroundSound",
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
  id: "step_has_surround_sound__recursive",
  params: {
    ...baseStep.params,
    isRecursive: true,
    recursiveDepth: 2,
  },
})
