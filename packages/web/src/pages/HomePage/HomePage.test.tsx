import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { HomePage } from "./HomePage"

afterEach(cleanup)

describe("HomePage", () => {
  test("renders the app title and the pick-a-tool prompt", () => {
    render(<HomePage />)
    expect(
      screen.getByRole("heading", {
        name: "Mux-Magic",
        level: 1,
      }),
    ).toBeVisible()
    expect(screen.getByText("Pick a tool.")).toBeVisible()
  })

  test("links to the builder", () => {
    render(<HomePage />)
    expect(
      screen.getByRole("link", { name: /builder/i }),
    ).toHaveAttribute("href", "/builder")
  })

  test("links to the jobs page", () => {
    render(<HomePage />)
    expect(
      screen.getByRole("link", { name: /jobs/i }),
    ).toHaveAttribute("href", "/jobs")
  })

  test("offers exactly two tools", () => {
    render(<HomePage />)
    expect(screen.getAllByRole("link")).toHaveLength(2)
  })
})
