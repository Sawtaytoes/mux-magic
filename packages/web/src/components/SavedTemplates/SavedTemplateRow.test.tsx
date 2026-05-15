import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { SavedTemplateRow } from "./SavedTemplateRow"

const template = {
  id: "movie-workflow",
  name: "Movie Workflow",
  description: "First pass",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

const buildHandlers = () => ({
  onLoad: vi.fn(),
  onUpdateFromCurrent: vi.fn(),
  onRename: vi.fn(),
  onEditDescription: vi.fn(),
  onDelete: vi.fn(),
})

afterEach(() => {
  cleanup()
})

describe("SavedTemplateRow", () => {
  test("renders the template name and description", () => {
    const handlers = buildHandlers()
    render(
      <SavedTemplateRow
        template={template}
        isSelected={false}
        {...handlers}
      />,
    )
    expect(
      screen.getByRole("button", {
        name: "Movie Workflow",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("First pass"),
    ).toBeInTheDocument()
  })

  test("fires onLoad when the name is clicked", () => {
    const handlers = buildHandlers()
    render(
      <SavedTemplateRow
        template={template}
        isSelected={false}
        {...handlers}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: "Movie Workflow",
      }),
    )
    expect(handlers.onLoad).toHaveBeenCalledTimes(1)
  })

  test("fires each management handler from its button", () => {
    const handlers = buildHandlers()
    render(
      <SavedTemplateRow
        template={template}
        isSelected={false}
        {...handlers}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Update" }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Rename" }),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit description",
      }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Delete" }),
    )
    expect(
      handlers.onUpdateFromCurrent,
    ).toHaveBeenCalledTimes(1)
    expect(handlers.onRename).toHaveBeenCalledTimes(1)
    expect(
      handlers.onEditDescription,
    ).toHaveBeenCalledTimes(1)
    expect(handlers.onDelete).toHaveBeenCalledTimes(1)
  })

  test("isSelected adds a blue border class", () => {
    const handlers = buildHandlers()
    const { container } = render(
      <SavedTemplateRow
        template={template}
        isSelected={true}
        {...handlers}
      />,
    )
    const row = container.querySelector("li")
    expect(row?.className).toContain("border-blue-500")
  })

  test("omits description paragraph when none is set", () => {
    const handlers = buildHandlers()
    render(
      <SavedTemplateRow
        template={{ ...template, description: undefined }}
        isSelected={false}
        {...handlers}
      />,
    )
    expect(screen.queryByText("First pass")).toBeNull()
  })
})
