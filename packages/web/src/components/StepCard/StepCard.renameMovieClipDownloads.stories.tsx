import type { Meta } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import { makeStory } from "./StepCard.storyHelpers"

const baseStep: Step = {
  id: "step_rename_movie_clips",
  alias: "Rename Movie Clip Downloads",
  command: "renameMovieClipDownloads",
  params: {
    sourcePath: "/mnt/downloads/movie-clips",
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const meta: Meta<typeof StepCard> = {
  title:
    "Components/StepCard/Commands/Naming Operations/renameMovieClipDownloads",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta

export const Default = makeStory(baseStep)

// Source wired to a path variable — typical when the downloads root is
// reused across multiple cleanup steps.
export const WithLinkedSourcePath = makeStory({
  ...baseStep,
  id: "step_rename_movie_clips__linked",
  params: { sourcePath: "" },
  links: { sourcePath: "downloadsRoot" },
})
