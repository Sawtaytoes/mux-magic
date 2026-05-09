import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InsertDivider } from "./InsertDivider"

const makeProps = () => ({
  onInsertStep: vi.fn(),
  onInsertSequentialGroup: vi.fn(),
  onInsertParallelGroup: vi.fn(),
  onPaste: vi.fn(),
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("InsertDivider", () => {
  it("renders all four action buttons", () => {
    render(<InsertDivider {...makeProps()} />)
    expect(screen.getByRole("button", { name: /insert a step here/i })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /insert a sequential group here/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /insert a parallel group here/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /paste a copied step or group here/i }),
    ).toBeInTheDocument()
  })

  it("calls onInsertStep when Step button is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<InsertDivider {...props} />)

    await user.click(screen.getByRole("button", { name: /insert a step here/i }))

    expect(props.onInsertStep).toHaveBeenCalledOnce()
  })

  it("calls onInsertSequentialGroup when Group button is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<InsertDivider {...props} />)

    await user.click(screen.getByRole("button", { name: /insert a sequential group here/i }))

    expect(props.onInsertSequentialGroup).toHaveBeenCalledOnce()
  })

  it("calls onInsertParallelGroup when Parallel button is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<InsertDivider {...props} />)

    await user.click(screen.getByRole("button", { name: /insert a parallel group here/i }))

    expect(props.onInsertParallelGroup).toHaveBeenCalledOnce()
  })

  it("calls onPaste when Paste button is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<InsertDivider {...props} />)

    await user.click(screen.getByRole("button", { name: /paste a copied step or group here/i }))

    expect(props.onPaste).toHaveBeenCalledOnce()
  })

  it("does not cross-fire callbacks", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<InsertDivider {...props} />)

    await user.click(screen.getByRole("button", { name: /insert a step here/i }))

    expect(props.onInsertSequentialGroup).not.toHaveBeenCalled()
    expect(props.onInsertParallelGroup).not.toHaveBeenCalled()
    expect(props.onPaste).not.toHaveBeenCalled()
  })
})
