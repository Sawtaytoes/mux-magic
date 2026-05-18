import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_delete_folder",
  alias: "Remove Temp Workspace",
  command: "deleteFolder",
  params: {
    sourcePath: "/mnt/work/tmp",
    confirm: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/File Operations/deleteFolder",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

// Confirmation unchecked — the server refuses to run in this state, so
// the card shows the destructive command in its "guarded" form.
export const Default = makeStory(baseStep)

// Confirmation explicitly acknowledged.
export const WithConfirmChecked = makeStory({
  ...baseStep,
  id: "step_delete_folder__confirmed",
  params: { ...baseStep.params, confirm: true },
})

// Source wired to an upstream step's folder output — delete the
// previous step's output folder after some downstream operation read
// from it.
export const WithChainedSource = makeStory({
  ...baseStep,
  id: "step_delete_folder__chained",
  params: {
    ...baseStep.params,
    sourcePath: "",
    confirm: true,
  },
  links: {
    sourcePath: {
      linkedTo: "step_upstream",
      output: "folder",
    },
  },
})
