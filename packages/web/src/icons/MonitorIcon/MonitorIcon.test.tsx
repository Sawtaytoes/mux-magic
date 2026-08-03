import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { MonitorIcon } from "./MonitorIcon"

afterEach(() => {
  cleanup()
})

describe("MonitorIcon", () => {
  test("renders an svg element", () => {
    const { container } = render(<MonitorIcon />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  test("renders the monitor frame rect", () => {
    const { container } = render(<MonitorIcon />)
    expect(container.querySelector("rect")).not.toBeNull()
  })
})
