import type { Meta, StoryObj } from "@storybook/react"
import type { NsfEditionPlanRecord } from "../NsfRunResults/findNsfResults"
import { EditionPlanPreview } from "./EditionPlanPreview"

const meta: Meta<typeof EditionPlanPreview> = {
  title: "Components/EditionPlanPreview",
  component: EditionPlanPreview,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}
export default meta

type Story = StoryObj<typeof EditionPlanPreview>

// Single edition with one main feature and a trailer sibling.
const singleEditionPlan: NsfEditionPlanRecord = {
  isEditionPlan: true,
  moves: [
    {
      sourceFilename:
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      destinationPath:
        "/Dragon Lord (1982)/Dragon Lord (1982) {edition-Hong Kong Version}/Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      editionName: "Hong Kong Version",
      isSibling: false,
    },
    {
      sourceFilename:
        "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
      destinationPath:
        "/Dragon Lord (1982)/Dragon Lord (1982) {edition-Hong Kong Version}/Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
      editionName: "Hong Kong Version",
      isSibling: true,
    },
  ],
}

// Two editions, each with a main feature and a trailer sibling.
const multiEditionPlan: NsfEditionPlanRecord = {
  isEditionPlan: true,
  moves: [
    {
      sourceFilename:
        "Movie (2020) {edition-DirectorsCut}.mkv",
      destinationPath:
        "/Movie (2020)/Movie (2020) {edition-DirectorsCut}/Movie (2020) {edition-DirectorsCut}.mkv",
      editionName: "DirectorsCut",
      isSibling: false,
    },
    {
      sourceFilename:
        "Movie (2020) {edition-DirectorsCut}-trailer.mkv",
      destinationPath:
        "/Movie (2020)/Movie (2020) {edition-DirectorsCut}/Movie (2020) {edition-DirectorsCut}-trailer.mkv",
      editionName: "DirectorsCut",
      isSibling: true,
    },
    {
      sourceFilename:
        "Movie (2020) {edition-Theatrical}.mkv",
      destinationPath:
        "/Movie (2020)/Movie (2020) {edition-Theatrical}/Movie (2020) {edition-Theatrical}.mkv",
      editionName: "Theatrical",
      isSibling: false,
    },
    {
      sourceFilename:
        "Movie (2020) {edition-Theatrical}-trailer.mkv",
      destinationPath:
        "/Movie (2020)/Movie (2020) {edition-Theatrical}/Movie (2020) {edition-Theatrical}-trailer.mkv",
      editionName: "Theatrical",
      isSibling: true,
    },
  ],
}

// Main feature only, no siblings.
const mainFeatureOnlyPlan: NsfEditionPlanRecord = {
  isEditionPlan: true,
  moves: [
    {
      sourceFilename:
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      destinationPath:
        "/Dragon Lord (1982)/Dragon Lord (1982) {edition-Hong Kong Version}/Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      editionName: "Hong Kong Version",
      isSibling: false,
    },
  ],
}

// Empty plan — no edition files detected. Component renders null.
const emptyPlan: NsfEditionPlanRecord = {
  isEditionPlan: true,
  moves: [],
}

export const SingleEditionWithSibling: Story = {
  args: {
    editionPlan: singleEditionPlan,
  },
}

export const MultiEditionWithSiblings: Story = {
  args: {
    editionPlan: multiEditionPlan,
  },
}

export const MainFeatureOnly: Story = {
  args: {
    editionPlan: mainFeatureOnlyPlan,
  },
}

export const EmptyPlan: Story = {
  args: {
    editionPlan: emptyPlan,
  },
}
