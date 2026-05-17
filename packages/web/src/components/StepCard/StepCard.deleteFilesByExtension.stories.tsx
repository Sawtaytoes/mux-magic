import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_delete_by_ext",
  alias: "Drop Sidecar Subs",
  command: "deleteFilesByExtension",
  params: {
    sourcePath: "/mnt/library/show",
    extensions: [".srt", ".idx", ".sub"],
    isRecursive: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/File Operations/deleteFilesByExtension",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Single extension only — minimum-value stringArray rendering.
export const WithSingleExtension = makeStory({
  ...baseStep,
  id: "step_delete_by_ext__single",
  params: { ...baseStep.params, extensions: [".srt"] },
})

// Recursive toggled on — recursiveDepth field appears via visibleWhen.
export const WithRecursiveDepth = makeStory({
  ...baseStep,
  id: "step_delete_by_ext__recursive",
  params: {
    ...baseStep.params,
    isRecursive: true,
    recursiveDepth: 2,
  },
})

// Empty extensions array — shows the placeholder/empty-state UI of
// the stringArray field.
export const WithEmptyExtensions = makeStory({
  ...baseStep,
  id: "step_delete_by_ext__empty",
  params: { ...baseStep.params, extensions: [] },
})
