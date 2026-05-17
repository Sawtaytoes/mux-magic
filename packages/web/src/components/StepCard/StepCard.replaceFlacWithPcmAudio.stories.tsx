import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_flac_to_pcm",
  alias: "Replace FLAC With PCM",
  command: "replaceFlacWithPcmAudio",
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
    "Components/StepCard/Commands/Audio Operations/replaceFlacWithPcmAudio",
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
  id: "step_flac_to_pcm__recursive",
  params: { ...baseStep.params, isRecursive: true },
})
