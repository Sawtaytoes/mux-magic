import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_move_files",
  alias: "Move To Archive",
  command: "moveFiles",
  params: {
    sourcePath: "/mnt/work/processed",
    destinationPath: "/mnt/archive",
    fileFilterRegex: { pattern: "", flags: "", sample: "" },
    renameRegex: {
      pattern: "",
      flags: "",
      replacement: "",
      sample: "",
    },
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/File Operations/moveFiles",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// File filter narrows the move to a specific extension set.
export const WithFileFilterRegex = makeStory({
  ...baseStep,
  id: "step_move_files__file_filter",
  alias: "Move Only MKVs",
  params: {
    ...baseStep.params,
    fileFilterRegex: {
      pattern: "\\.mkv$",
      flags: "i",
      sample: "Movie.mkv",
    },
  },
})

// Both rename + filter in one move — common when reorganizing a library.
export const WithRenameAndFilter = makeStory({
  ...baseStep,
  id: "step_move_files__rename_and_filter",
  params: {
    ...baseStep.params,
    fileFilterRegex: {
      pattern: "\\.mkv$",
      flags: "i",
      sample: "Movie.mkv",
    },
    renameRegex: {
      pattern: "^(.+?)\\s+\\[.+?\\]",
      flags: "",
      replacement: "$1",
      sample: "Movie Title [Source]",
    },
  },
})

// Source + destination wired to path variables (workRoot, archiveRoot).
export const WithLinkedSourceAndDestination = makeStory({
  ...baseStep,
  id: "step_move_files__linked_paths",
  params: {
    ...baseStep.params,
    sourcePath: "",
    destinationPath: "",
  },
  links: {
    sourcePath: "workRoot",
    destinationPath: "archiveRoot",
  },
})
