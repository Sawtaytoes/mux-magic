import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_flatten_output",
  alias: "Flatten Encoded Output",
  command: "flattenOutput",
  params: {
    sourcePath: "/mnt/work/encoded",
    deleteSourceFolder: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/File Operations/flattenOutput",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

// Plain path, source folder preserved after flattening.
export const Default = makeStory(baseStep)

// `deleteSourceFolder` toggled on — the source folder is removed after
// its contents are flattened up one level.
export const WithDeleteSourceFolder = makeStory({
  ...baseStep,
  id: "step_flatten_output__delete_source",
  alias: "Flatten + Remove Folder",
  params: { ...baseStep.params, deleteSourceFolder: true },
})

// Source path chained off an upstream step's `folder` output — the
// typical use of flattenOutput (collapse the previous step's
// outputFolderName).
export const WithChainedSource = makeStory({
  ...baseStep,
  id: "step_flatten_output__chained",
  params: { ...baseStep.params, sourcePath: "" },
  links: {
    sourcePath: { linkedTo: "step_upstream", output: "folder" },
  },
})
