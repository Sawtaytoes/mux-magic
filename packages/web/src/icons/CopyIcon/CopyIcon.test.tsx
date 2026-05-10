import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { CopyIcon } from "./CopyIcon"

afterEach(() => {
  cleanup()
})

describe("CopyIcon", () => {
  test("renders an svg element", () => {
    const { container } = render(<CopyIcon />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  test("renders the copy rectangle shape", () => {
    const { container } = render(<CopyIcon />)
    expect(container.querySelector("rect")).not.toBeNull()
  })

  test("renders the backing page path", () => {
    const { container } = render(<CopyIcon />)
    expect(container.querySelector("path")).not.toBeNull()
  })
})
