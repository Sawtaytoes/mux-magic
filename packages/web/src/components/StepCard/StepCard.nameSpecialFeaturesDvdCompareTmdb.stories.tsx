import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_name_special_features",
  alias: "Name Special Features",
  command: "nameSpecialFeaturesDvdCompareTmdb",
  params: {
    sourcePath: "/mnt/movies/special-features",
    dvdCompareId: 74759,
    dvdCompareName: "Sample Movie",
    dvdCompareReleaseHash: 1,
    dvdCompareReleaseLabel: "Special Edition",
    tmdbId: 603,
    tmdbName: "The Matrix",
    fixedOffset: 0,
    timecodePadding: 2,
    autoNameDuplicates: false,
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Naming Operations/nameSpecialFeaturesDvdCompareTmdb",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

// Interactive default — duplicates trigger Phase-B "which file is
// which?" pick modal at runtime.
export const Default = makeStory(baseStep)

// Auto-name duplicates toggled on — duplicates get (2)/(3)/… suffixes
// deterministically without a prompt.
export const WithAutoNameDuplicates = makeStory({
  ...baseStep,
  id: "step_name_special_features__auto_dupes",
  params: { ...baseStep.params, autoNameDuplicates: true },
})

// Fixed offset + tighter timecode padding — used when DVDCompare and
// the file durations only loosely align.
export const WithCustomOffsetAndPadding = makeStory({
  ...baseStep,
  id: "step_name_special_features__offset_padding",
  params: {
    ...baseStep.params,
    fixedOffset: 15,
    timecodePadding: 5,
  },
})

// Linkable DVDCompare ID wired to a Variable.
export const WithLinkedDvdCompareId = makeStory({
  ...baseStep,
  id: "step_name_special_features__linked_lookup",
  params: {
    ...baseStep.params,
    dvdCompareId: undefined,
    dvdCompareName: undefined,
  },
  links: { dvdCompareId: "currentFilm" },
})
