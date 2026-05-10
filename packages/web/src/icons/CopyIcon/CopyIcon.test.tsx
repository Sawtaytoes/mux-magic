import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { CopyIcon } from "./CopyIcon"

afterEach(() => {
  cleanup()
})

describe("CopyIcon", () => {
  it("renders an svg element", () => {
    const { container } = render(<CopyIcon />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("renders the copy rectangle shape", () => {
    const { container } = render(<CopyIcon />)
    expect(container.querySelector("rect")).not.toBeNull()
  })

  it("renders the backing page path", () => {
    const { container } = render(<CopyIcon />)
    expect(container.querySelector("path")).not.toBeNull()
  })
})
