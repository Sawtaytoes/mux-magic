import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_add_subtitles",
  alias: "Mux Subtitles",
  command: "addSubtitles",
  params: {
    sourcePath: "/mnt/library/show",
    subtitlesPath: "/mnt/subtitles/show",
    hasChapterSyncOffset: false,
    includeChapters: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Subtitle Operations/addSubtitles",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Single global offset applied to every episode.
export const WithGlobalOffset = makeStory({
  ...baseStep,
  id: "step_add_subtitles__global_offset",
  params: { ...baseStep.params, globalOffset: -150 },
})

// Per-file offsets — the typical use when each episode drifts slightly
// differently after source frame-rate conversion.
export const WithPerFileOffsets = makeStory({
  ...baseStep,
  id: "step_add_subtitles__per_file_offsets",
  params: { ...baseStep.params, offsets: [0, -200, 150, -50] },
})

// Chapter-sync + include chapters — typical for season-pack subtitle
// muxes that also need chapters.xml folded in.
export const WithChapterSyncAndChapters = makeStory({
  ...baseStep,
  id: "step_add_subtitles__chapter_sync",
  params: {
    ...baseStep.params,
    hasChapterSyncOffset: true,
    includeChapters: true,
  },
})

// Subtitles path wired to a variable — reused across many shows that
// share the same subtitle root.
export const WithLinkedSubtitlesPath = makeStory({
  ...baseStep,
  id: "step_add_subtitles__linked_subs",
  params: { ...baseStep.params, subtitlesPath: "" },
  links: { subtitlesPath: "subtitlesRoot" },
})
