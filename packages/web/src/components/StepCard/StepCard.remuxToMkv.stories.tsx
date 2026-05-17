import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_remux_to_mkv",
  alias: "Remux To MKV",
  command: "remuxToMkv",
  params: {
    sourcePath: "/mnt/incoming",
    extensions: [".ts", ".m2ts"],
    isRecursive: false,
    isSourceDeletedOnSuccess: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/File Operations/remuxToMkv",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Recursive toggled on — recursiveDepth field appears via visibleWhen.
export const WithRecursiveDepth = makeStory({
  ...baseStep,
  id: "step_remux_to_mkv__recursive",
  params: {
    ...baseStep.params,
    isRecursive: true,
    recursiveDepth: 3,
  },
})

// Source deletion enabled — the originals are removed once each file
// successfully remuxes.
export const WithDeleteSourceOnSuccess = makeStory({
  ...baseStep,
  id: "step_remux_to_mkv__delete_source",
  alias: "Remux + Replace Originals",
  params: {
    ...baseStep.params,
    isSourceDeletedOnSuccess: true,
  },
})

// Single extension — narrower input set.
export const WithSingleExtension = makeStory({
  ...baseStep,
  id: "step_remux_to_mkv__single_ext",
  params: { ...baseStep.params, extensions: [".ts"] },
})
