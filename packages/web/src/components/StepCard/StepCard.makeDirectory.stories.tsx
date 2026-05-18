import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_make_directory",
  alias: "Create Output Folder",
  command: "makeDirectory",
  params: {
    sourcePath: "/mnt/output/new-folder",
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/File Operations/makeDirectory",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

// A typed-in absolute path — the most common usage.
export const Default = makeStory(baseStep)

// `sourcePath` is wired to a path variable named "outputRoot". The card
// shows a chip/link affordance instead of the bare input.
export const WithLinkedPathVariable = makeStory({
  ...baseStep,
  id: "step_make_directory__linked_var",
  params: { sourcePath: "" },
  links: { sourcePath: "outputRoot" },
})

// `sourcePath` chains off the `folder` output of a previous step.
export const WithChainedFromPreviousStep = makeStory({
  ...baseStep,
  id: "step_make_directory__chained",
  params: { sourcePath: "" },
  links: {
    sourcePath: {
      linkedTo: "step_upstream",
      output: "folder",
    },
  },
})

// Fresh step with no path entered yet — shows placeholder/empty-input UI.
export const WithEmptyPath = makeStory({
  ...baseStep,
  id: "step_make_directory__empty",
  alias: "",
  params: { sourcePath: "" },
})
