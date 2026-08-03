import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { ToolCard } from "./ToolCard"

afterEach(cleanup)

const renderCard = () => {
  render(
    <ToolCard
      href="/builder"
      icon={<svg data-testid="tool-icon" />}
      title="Builder"
      description="Compose a sequence of media commands."
    />,
  )
}

describe("ToolCard", () => {
  test("links the whole card to href", () => {
    renderCard()
    expect(
      screen.getByRole("link", { name: /builder/i }),
    ).toHaveAttribute("href", "/builder")
  })

  test("renders the title as a heading", () => {
    renderCard()
    expect(
      screen.getByRole("heading", { name: "Builder" }),
    ).toBeVisible()
  })

  test("renders the description", () => {
    renderCard()
    expect(
      screen.getByText(
        "Compose a sequence of media commands.",
      ),
    ).toBeVisible()
  })

  test("renders the icon it is given", () => {
    renderCard()
    expect(
      screen.getByTestId("tool-icon"),
    ).toBeInTheDocument()
  })
})
