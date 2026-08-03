import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { MoonIcon } from "./MoonIcon"

afterEach(() => {
  cleanup()
})

describe("MoonIcon", () => {
  test("renders an svg element", () => {
    const { container } = render(<MoonIcon />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  test("renders the crescent path", () => {
    const { container } = render(<MoonIcon />)
    expect(container.querySelector("path")).not.toBeNull()
  })
})
