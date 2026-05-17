import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_name_anime_episodes",
  alias: "Rename (MAL)",
  command: "nameAnimeEpisodes",
  params: {
    sourcePath: "/mnt/anime/incoming",
    malId: 39534,
    malName: "Sample Anime (Season 1)",
    seasonNumber: 1,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Naming Operations/nameAnimeEpisodes",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// MAL ID with no companion name resolved yet — the typical "just
// typed an ID" intermediate state.
export const WithUnresolvedMalId = makeStory({
  ...baseStep,
  id: "step_name_anime_episodes__unresolved",
  params: {
    sourcePath: "/mnt/anime/incoming",
    malId: 99999,
    seasonNumber: 1,
  },
})

// Custom season number for shows where MAL splits cours across IDs.
export const WithCustomSeason = makeStory({
  ...baseStep,
  id: "step_name_anime_episodes__season_2",
  params: { ...baseStep.params, seasonNumber: 2 },
})

// Empty MAL ID — placeholder shows on the numberWithLookup field.
export const WithEmptyLookup = makeStory({
  ...baseStep,
  id: "step_name_anime_episodes__empty",
  alias: "",
  params: { sourcePath: "/mnt/anime/incoming" },
})
