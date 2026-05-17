import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_split_chapters",
  alias: "Split By Chapter",
  command: "splitChapters",
  params: {
    sourcePath: "/mnt/library/movie.mkv",
    chapterSplits: ["ch1", "ch5", "ch10"],
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/File Operations/splitChapters",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Two splits — minimum-value chapter list.
export const WithTwoSplits = makeStory({
  ...baseStep,
  id: "step_split_chapters__two",
  params: {
    ...baseStep.params,
    chapterSplits: ["ch1", "ch6"],
  },
})

// Empty chapter list — placeholder/empty stringArray rendering.
export const WithEmptySplits = makeStory({
  ...baseStep,
  id: "step_split_chapters__empty",
  params: { ...baseStep.params, chapterSplits: [] },
})
