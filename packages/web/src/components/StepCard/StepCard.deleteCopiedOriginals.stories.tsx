import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_delete_copied_originals",
  alias: "Clean Up Originals",
  command: "deleteCopiedOriginals",
  params: {
    pathsToDelete: [],
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/File Operations/deleteCopiedOriginals",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

// Empty list — the no-op baseline shape. Wiring happens via the link
// picker on the `pathsToDelete` field.
export const Default = makeStory(baseStep)

// `pathsToDelete` linked to an upstream copyFiles step's
// `copiedSourcePaths` output — the canonical use of this command.
export const WithLinkedFromCopyFiles = makeStory({
  ...baseStep,
  id: "step_delete_copied_originals__linked",
  links: {
    pathsToDelete: {
      linkedTo: "step_copy",
      output: "copiedSourcePaths",
    },
  },
})

// Manually populated paths (rare, but supported when the upstream is a
// custom source rather than copyFiles).
export const WithManualPaths = makeStory({
  ...baseStep,
  id: "step_delete_copied_originals__manual",
  params: {
    pathsToDelete: [
      "/mnt/source/Movie.A.mkv",
      "/mnt/source/Movie.B.mkv",
    ],
  },
})
