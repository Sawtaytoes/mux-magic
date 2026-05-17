import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_exit_if_empty",
  alias: "Skip If No Work",
  command: "exitIfEmpty",
  params: {
    sourcePath: "/mnt/incoming",
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Flow Control/exitIfEmpty",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// `sourcePath` chained off an upstream filter step — exit early when
// the upstream produced no work.
export const WithChainedSource = makeStory({
  ...baseStep,
  id: "step_exit_if_empty__chained",
  params: { sourcePath: "" },
  links: {
    sourcePath: { linkedTo: "step_upstream", output: "folder" },
  },
})
