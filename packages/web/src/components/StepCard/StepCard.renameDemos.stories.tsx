import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_rename_demos",
  alias: "Rename Demos",
  command: "renameDemos",
  params: {
    sourcePath: "/mnt/library/demos",
    isRecursive: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Naming Operations/renameDemos",
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
  id: "step_rename_demos__recursive",
  params: { ...baseStep.params, isRecursive: true },
})
