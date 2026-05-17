import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_name_tv_episodes",
  alias: "Rename TV Episodes",
  command: "nameTvShowEpisodes",
  params: {
    sourcePath: "/mnt/tv/incoming",
    tvdbId: 76703,
    tvdbName: "Sample Show",
    seasonNumber: 1,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Naming Operations/nameTvShowEpisodes",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Season 2 — typical when ingesting later seasons of an existing show.
export const WithLaterSeason = makeStory({
  ...baseStep,
  id: "step_name_tv_episodes__season_2",
  params: { ...baseStep.params, seasonNumber: 2 },
})

// Unresolved TVDB ID (lookup not yet performed).
export const WithUnresolvedTvdbId = makeStory({
  ...baseStep,
  id: "step_name_tv_episodes__unresolved",
  params: {
    sourcePath: "/mnt/tv/incoming",
    tvdbId: 99999,
    seasonNumber: 1,
  },
})
