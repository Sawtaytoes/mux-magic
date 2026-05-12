import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { PredicatesMap } from "./types"
import { PredicatesManager } from "./PredicatesManager"

afterEach(() => {
  cleanup()
})

const renderPredicatesManager = (
  predicates: PredicatesMap = {},
  openDetailsKeys: Set<string> = new Set(),
) =>
  render(
    <PredicatesManager
      predicates={predicates}
      isReadOnly={false}
      stepId="test-step"
      openDetailsKeys={openDetailsKeys}
      onToggleDetails={vi.fn()}
      onCommitPredicates={vi.fn()}
    />,
  )

describe("PredicatesManager chevron (B5)", () => {
  it("renders an svg chevron in the Predicates toggle button", () => {
    renderPredicatesManager()
    const button = screen.getByRole("button", {
      name: /predicates/i,
    })
    const svg = button.querySelector("svg")
    expect(svg).not.toBeNull()
  })

  it("svg has -rotate-90 when predicates section is collapsed", () => {
    renderPredicatesManager()
    const button = screen.getByRole("button", {
      name: /predicates/i,
    })
    const svg = button.querySelector("svg")
    expect(svg?.className).toContain("-rotate-90")
  })

  it("svg loses -rotate-90 after clicking to expand", async () => {
    renderPredicatesManager()
    const button = screen.getByRole("button", {
      name: /predicates/i,
    })
    await userEvent.click(button)
    const svg = button.querySelector("svg")
    expect(svg?.className).not.toContain("-rotate-90")
  })

  it("clicking again re-collapses and restores -rotate-90", async () => {
    renderPredicatesManager()
    const button = screen.getByRole("button", {
      name: /predicates/i,
    })
    await userEvent.click(button)
    await userEvent.click(button)
    const svg = button.querySelector("svg")
    expect(svg?.className).toContain("-rotate-90")
  })
})
