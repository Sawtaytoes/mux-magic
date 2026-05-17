import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_name_anime_anidb",
  alias: "Rename (AniDB)",
  command: "nameAnimeEpisodesAniDB",
  params: {
    sourcePath: "/mnt/anime/incoming",
    anidbId: 8160,
    anidbName: "Sample Anime",
    seasonNumber: 1,
    episodeType: "regular",
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Naming Operations/nameAnimeEpisodesAniDB",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

// Regular episodes — the most common shape (`type=1` in AniDB).
export const Default = makeStory(baseStep)

// Specials (`S`, `type=2`) — prompts per-file in the job log.
export const WithSpecials = makeStory({
  ...baseStep,
  id: "step_name_anime_anidb__specials",
  alias: "Rename Specials",
  params: { ...baseStep.params, episodeType: "specials" },
})

// Credits / OP / ED (`C`, `type=3`).
export const WithCredits = makeStory({
  ...baseStep,
  id: "step_name_anime_anidb__credits",
  alias: "Rename Credits",
  params: { ...baseStep.params, episodeType: "credits" },
})

// Others / alt cuts (`O`, `type=6`).
export const WithOthers = makeStory({
  ...baseStep,
  id: "step_name_anime_anidb__others",
  alias: "Rename Alt Cuts",
  params: { ...baseStep.params, episodeType: "others" },
})

// Unresolved AniDB ID (lookup not yet performed).
export const WithUnresolvedAnidbId = makeStory({
  ...baseStep,
  id: "step_name_anime_anidb__unresolved",
  params: {
    sourcePath: "/mnt/anime/incoming",
    anidbId: 99999,
    seasonNumber: 1,
    episodeType: "regular",
  },
})
