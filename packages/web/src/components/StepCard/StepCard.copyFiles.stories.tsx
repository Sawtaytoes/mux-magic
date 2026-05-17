import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_copy_files",
  alias: "Copy MKVs to Archive",
  command: "copyFiles",
  params: {
    sourcePath: "/mnt/work/encoded",
    destinationPath: "/mnt/archive",
    fileFilterRegex: { pattern: "", flags: "", sample: "" },
    includeFolders: false,
    folderFilterRegex: { pattern: "", flags: "", sample: "" },
    renameRegex: { pattern: "", flags: "", replacement: "", sample: "" },
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/File Operations/copyFiles",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

// Plain source/destination, no filters — the baseline.
export const Default = makeStory(baseStep)

// File filter regex set, with a sample string to preview matches against.
export const WithFileFilterRegexAndSample = makeStory({
  ...baseStep,
  id: "step_copy_files__file_filter",
  alias: "Copy Only MKVs",
  params: {
    ...baseStep.params,
    fileFilterRegex: {
      pattern: "\\.mkv$",
      flags: "i",
      sample: "Movie.2024.mkv",
    },
  },
})

// File filter set but the optional "Test against" sample is empty.
export const WithFileFilterButEmptySample = makeStory({
  ...baseStep,
  id: "step_copy_files__file_filter_empty_sample",
  params: {
    ...baseStep.params,
    fileFilterRegex: { pattern: "\\.mkv$", flags: "i", sample: "" },
  },
})

// `includeFolders` toggled on — the conditional `folderFilterRegex`
// field becomes visible via its `visibleWhen` dependency.
export const WithIncludeFoldersAndFolderFilter = makeStory({
  ...baseStep,
  id: "step_copy_files__include_folders",
  alias: "Copy Season Folders",
  params: {
    ...baseStep.params,
    includeFolders: true,
    folderFilterRegex: {
      pattern: "^Season\\s\\d+",
      flags: "",
      sample: "Season 02",
    },
  },
})

// Rename regex configured — files get renamed at copy time.
export const WithRenameRegex = makeStory({
  ...baseStep,
  id: "step_copy_files__rename",
  alias: "Copy + Strip Group Tags",
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

// Both source and destination wired to path variables — common when the
// same roots are reused across many steps.
export const WithLinkedSourceAndDestination = makeStory({
  ...baseStep,
  id: "step_copy_files__linked_paths",
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

// Source chained off an upstream step's folder output.
export const WithChainedSource = makeStory({
  ...baseStep,
  id: "step_copy_files__chained",
  params: { ...baseStep.params, sourcePath: "" },
  links: {
    sourcePath: { linkedTo: "step_upstream", output: "folder" },
  },
})
