import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_store_aspect_ratio",
  alias: "Store Aspect Ratios",
  command: "storeAspectRatioData",
  params: {
    sourcePath: "/mnt/library/movies",
    isRecursive: false,
    outputPath: "/mnt/metadata/aspect-ratio.json",
    rootPath: "/media/movies",
    force: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Metadata Operations/storeAspectRatioData",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Folder multi-select populated — narrows the scan to a subset of
// folders under sourcePath.
export const WithFolderMultiSelect = makeStory({
  ...baseStep,
  id: "step_store_aspect_ratio__folders",
  params: {
    ...baseStep.params,
    folders: ["Movies", "Concerts"],
  },
})

// Force overwrite enabled — replaces existing aspect-ratio output.
export const WithForceOverwrite = makeStory({
  ...baseStep,
  id: "step_store_aspect_ratio__force",
  params: { ...baseStep.params, force: true },
})

// Recursive toggle on — recursiveDepth appears via visibleWhen.
export const WithRecursiveDepth = makeStory({
  ...baseStep,
  id: "step_store_aspect_ratio__recursive",
  params: {
    ...baseStep.params,
    isRecursive: true,
    recursiveDepth: 3,
  },
})

// Plex-style root path override — rootPath is what the media player
// sees, separate from where the files live on this machine.
export const WithCustomRootPath = makeStory({
  ...baseStep,
  id: "step_store_aspect_ratio__root_path",
  params: {
    ...baseStep.params,
    rootPath: "/data/plex/movies",
  },
})
