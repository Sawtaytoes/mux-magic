import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import type { NsfEditionPlanRecord } from "../NsfRunResults/findNsfResults"
import { EditionPlanPreview } from "./EditionPlanPreview"

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

describe(EditionPlanPreview.name, () => {
  test("renders nothing when moves array is empty", () => {
    const emptyPlan: NsfEditionPlanRecord = {
      isEditionPlan: true,
      moves: [],
    }
    const { container } = render(
      <EditionPlanPreview editionPlan={emptyPlan} />,
    )
    expect(container.firstChild).toBeNull()
  })

  test("renders the edition plan preview section", () => {
    render(
      <EditionPlanPreview
        editionPlan={singleEditionPlan}
      />,
    )
    expect(
      screen.getByText(/Edition folders planned/),
    ).toBeVisible()
  })

  test("displays the edition name as a group header", () => {
    render(
      <EditionPlanPreview
        editionPlan={singleEditionPlan}
      />,
    )
    expect(
      screen.getByText("Hong Kong Version"),
    ).toBeVisible()
  })

  test("displays the main feature filename", () => {
    render(
      <EditionPlanPreview
        editionPlan={singleEditionPlan}
      />,
    )
    expect(
      screen.getByText(
        "Dragon Lord (1982) {edition-Hong Kong Version}.mkv",
      ),
    ).toBeVisible()
  })

  test("displays the sibling trailer filename with (sibling) badge", () => {
    render(
      <EditionPlanPreview
        editionPlan={singleEditionPlan}
      />,
    )
    expect(
      screen.getByText(
        "Dragon Lord (1982) {edition-Hong Kong Version}-trailer.mkv",
      ),
    ).toBeVisible()
    expect(screen.getByText("(sibling)")).toBeVisible()
  })

  test("renders two edition groups for a multi-edition plan", () => {
    const multiPlan: NsfEditionPlanRecord = {
      isEditionPlan: true,
      moves: [
        {
          sourceFilename:
            "Movie (2020) {edition-DirectorsCut}.mkv",
          destinationPath: "/dest/a.mkv",
          editionName: "DirectorsCut",
          isSibling: false,
        },
        {
          sourceFilename:
            "Movie (2020) {edition-Theatrical}.mkv",
          destinationPath: "/dest/b.mkv",
          editionName: "Theatrical",
          isSibling: false,
        },
      ],
    }
    render(<EditionPlanPreview editionPlan={multiPlan} />)
    expect(screen.getByText("DirectorsCut")).toBeVisible()
    expect(screen.getByText("Theatrical")).toBeVisible()
  })

  test("shows correct file count in the header", () => {
    render(
      <EditionPlanPreview
        editionPlan={singleEditionPlan}
      />,
    )
    expect(screen.getByText(/2 files/)).toBeVisible()
  })
})
