import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_modify_subtitle_metadata",
  alias: "Apply Subtitle Rules",
  command: "modifySubtitleMetadata",
  params: {
    sourcePath: "/mnt/subtitles",
    isRecursive: false,
    rules: [],
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Subtitle Operations/modifySubtitleMetadata",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

// Empty rules + default-rules toggle off — the "do nothing" baseline.
export const Default = makeStory(baseStep)

// Default-rules toggle on — prepends the in-tree heuristic rule set
// without requiring any user-defined rules.
export const WithDefaultRules = makeStory({
  ...baseStep,
  id: "step_modify_subtitle_metadata__default_rules",
  params: { ...baseStep.params, hasDefaultRules: true },
})

// Recursive toggle on — recursiveDepth field appears via visibleWhen.
export const WithRecursiveDepth = makeStory({
  ...baseStep,
  id: "step_modify_subtitle_metadata__recursive",
  params: {
    ...baseStep.params,
    isRecursive: true,
    recursiveDepth: 2,
  },
})
