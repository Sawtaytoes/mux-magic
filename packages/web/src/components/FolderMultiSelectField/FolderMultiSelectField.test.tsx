import { render, screen } from "@testing-library/react"
import { Provider } from "jotai"
import { describe, expect, test } from "vitest"

import { FIXTURE_COMMANDS_BUNDLE_D } from "../../commands/__fixtures__/commands"
import type { Step } from "../../types"
import { FolderMultiSelectField } from "./FolderMultiSelectField"

const createTestStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "test-step-1",
  alias: "",
  command: "storeAspectRatioData",
  params: { folders: [] },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

describe("FolderMultiSelectField", () => {
  const field =
    FIXTURE_COMMANDS_BUNDLE_D.storeAspectRatioData.fields[1]

  test("renders empty state", () => {
    const step = createTestStep()
    render(
      <Provider>
        <FolderMultiSelectField field={field} step={step} />
      </Provider>,
    )
    const browseButton = screen.getByText(/browse folders/i)
    expect(browseButton).toBeInTheDocument()
  })

  test("shows folder tags when folders are present", () => {
    const step = createTestStep({
      params: {
        sourcePath: "/home/user",
        folders: ["folder1", "folder2"],
      },
    })
    render(
      <Provider>
        <FolderMultiSelectField field={field} step={step} />
      </Provider>,
    )
    expect(screen.getByText(/folder1/)).toBeInTheDocument()
    expect(screen.getByText(/folder2/)).toBeInTheDocument()
  })

  test("displays remove buttons for each folder", () => {
    const step = createTestStep({
      params: { folders: ["folder1"] },
    })
    render(
      <Provider>
        <FolderMultiSelectField field={field} step={step} />
      </Provider>,
    )
    const removeButtons = screen.getAllByTitle(/remove/i)
    expect(removeButtons.length).toBeGreaterThan(0)
  })

  test("shows browse button", () => {
    const step = createTestStep()
    render(
      <Provider>
        <FolderMultiSelectField field={field} step={step} />
      </Provider>,
    )
    expect(
      screen.getByText(/browse folders/i),
    ).toBeInTheDocument()
  })
})
