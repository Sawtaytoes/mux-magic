import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_rename_files",
  alias: "Rename Files In Place",
  command: "renameFiles",
  params: {
    sourcePath: "/mnt/library/show",
    isRecursive: false,
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
    "Components/StepCard/Commands/File Operations/renameFiles",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Recursive toggled on — `recursiveDepth` field appears via visibleWhen.
export const WithRecursiveDepth = makeStory({
  ...baseStep,
  id: "step_rename_files__recursive",
  params: {
    ...baseStep.params,
    isRecursive: true,
    recursiveDepth: 3,
  },
})

// File-filter regex with a sample to preview matches.
export const WithFileFilterRegex = makeStory({
  ...baseStep,
  id: "step_rename_files__file_filter",
  params: {
    ...baseStep.params,
    fileFilterRegex: {
      pattern: "\\.mkv$",
      flags: "i",
      sample: "Episode.01.mkv",
    },
  },
})

// Strip group tags from filenames via the rename regex.
export const WithRenameRegex = makeStory({
  ...baseStep,
  id: "step_rename_files__rename",
  alias: "Strip Group Tags",
  params: {
    ...baseStep.params,
    renameRegex: {
      pattern: "^\\[.+?\\]\\s*",
      flags: "",
      replacement: "",
      sample: "[GroupName] Episode 01.mkv",
    },
  },
})
