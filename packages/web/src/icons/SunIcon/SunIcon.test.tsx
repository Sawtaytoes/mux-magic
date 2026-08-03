import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { SunIcon } from "./SunIcon"

afterEach(() => {
  cleanup()
})

describe("SunIcon", () => {
  test("renders an svg element", () => {
    const { container } = render(<SunIcon />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  test("renders the sun disc circle", () => {
    const { container } = render(<SunIcon />)
    expect(container.querySelector("circle")).not.toBeNull()
  })
})
