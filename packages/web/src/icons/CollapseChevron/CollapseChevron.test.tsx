import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { CollapseChevron } from "./CollapseChevron"

afterEach(() => {
  cleanup()
})

describe("CollapseChevron", () => {
  test("renders an svg element", () => {
    const { container } = render(
      <CollapseChevron isCollapsed={false} />,
    )
    expect(container.querySelector("svg")).not.toBeNull()
  })

  test("does not apply rotate class when expanded", () => {
    const { container } = render(
      <CollapseChevron isCollapsed={false} />,
    )
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("class")).not.toContain(
      "-rotate-90",
    )
  })

  test("applies -rotate-90 class when collapsed", () => {
    const { container } = render(
      <CollapseChevron isCollapsed={true} />,
    )
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("class")).toContain(
      "-rotate-90",
    )
  })
})
