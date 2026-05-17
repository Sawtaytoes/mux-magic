import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_has_duplicate_music_files",
  alias: "Find Duplicate Music",
  command: "hasDuplicateMusicFiles",
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
    "Components/StepCard/Commands/Analysis/hasDuplicateMusicFiles",
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
  id: "step_has_duplicate_music_files__recursive",
  params: {
    ...baseStep.params,
    isRecursive: true,
    recursiveDepth: 4,
  },
})
