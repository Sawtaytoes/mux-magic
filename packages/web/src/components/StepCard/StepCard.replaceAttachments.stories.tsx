import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_replace_attachments",
  alias: "Swap Attachments",
  command: "replaceAttachments",
  params: {
    sourcePath: "/mnt/library/show",
    destinationFilesPath: "/mnt/replacement-assets",
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/File Operations/replaceAttachments",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Both paths wired to variables — replacement-assets root is reused
// across many shows in the same sequence.
export const WithLinkedPaths = makeStory({
  ...baseStep,
  id: "step_replace_attachments__linked",
  params: {
    sourcePath: "",
    destinationFilesPath: "",
  },
  links: {
    sourcePath: "libraryRoot",
    destinationFilesPath: "attachmentsRoot",
  },
})
