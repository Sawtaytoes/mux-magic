import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_get_audio_offsets",
  alias: "Compute Audio Offsets",
  command: "getAudioOffsets",
  params: {
    sourcePath: "/mnt/source/episodes",
    destinationFilesPath: "/mnt/replacement-audio",
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Audio Operations/getAudioOffsets",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Both paths wired to variables — typical when running offset analysis
// across multiple shows that share the same alt-audio root.
export const WithLinkedPaths = makeStory({
  ...baseStep,
  id: "step_get_audio_offsets__linked",
  params: { sourcePath: "", destinationFilesPath: "" },
  links: {
    sourcePath: "showRoot",
    destinationFilesPath: "altAudioRoot",
  },
})
