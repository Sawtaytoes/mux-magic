import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_set_display_width",
  alias: "Set Display Width",
  command: "setDisplayWidth",
  params: {
    sourcePath: "/mnt/library/movies",
    displayWidth: 1920,
    isRecursive: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Video Operations/setDisplayWidth",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// 4K display width — typical for UHD-grade sources.
export const With4KWidth = makeStory({
  ...baseStep,
  id: "step_set_display_width__4k",
  params: { ...baseStep.params, displayWidth: 3840 },
})

// 720p — useful when correcting upscaled SD sources.
export const With720pWidth = makeStory({
  ...baseStep,
  id: "step_set_display_width__720p",
  params: { ...baseStep.params, displayWidth: 1280 },
})

// Recursive — apply width across a folder tree.
export const WithRecursiveDepth = makeStory({
  ...baseStep,
  id: "step_set_display_width__recursive",
  params: {
    ...baseStep.params,
    isRecursive: true,
    recursiveDepth: 2,
  },
})
