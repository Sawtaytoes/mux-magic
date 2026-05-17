import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_name_movie_cuts",
  alias: "Name Movie Cuts",
  command: "nameMovieCutsDvdCompareTmdb",
  params: {
    sourcePath: "/mnt/movies/incoming",
    dvdCompareId: 12345,
    dvdCompareName: "Sample Movie",
    dvdCompareReleaseHash: 1,
    dvdCompareReleaseLabel: "Theatrical Edition",
    tmdbId: 603,
    tmdbName: "The Matrix",
    fixedOffset: 0,
    timecodePadding: 2,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Naming Operations/nameMovieCutsDvdCompareTmdb",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Different DVDCompare release picked (Director's Cut vs Theatrical) —
// release label changes alongside the hash.
export const WithDirectorsCutRelease = makeStory({
  ...baseStep,
  id: "step_name_movie_cuts__directors_cut",
  params: {
    ...baseStep.params,
    dvdCompareReleaseHash: 2,
    dvdCompareReleaseLabel: "Director's Cut",
  },
})

// Fixed offset applied — used when DVDCompare timecodes have a global
// drift vs the source files.
export const WithFixedOffset = makeStory({
  ...baseStep,
  id: "step_name_movie_cuts__fixed_offset",
  params: { ...baseStep.params, fixedOffset: 30 },
})

// Linkable DVDCompare ID wired to a Variable from the registry (worker
// 35) — common when multiple steps reference the same film.
export const WithLinkedDvdCompareId = makeStory({
  ...baseStep,
  id: "step_name_movie_cuts__linked_lookup",
  params: {
    ...baseStep.params,
    dvdCompareId: undefined,
    dvdCompareName: undefined,
  },
  links: { dvdCompareId: "currentFilm" },
})
