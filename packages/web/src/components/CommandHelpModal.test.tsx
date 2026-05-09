import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { commandHelpModalCommandAtom } from "../state/uiAtoms"
import { CommandHelpModal } from "./CommandHelpModal"

const mockCommand = {
  summary: "Encodes video with ffmpeg.",
  fields: [
    { name: "input", label: "Input file", type: "path", required: true },
    { name: "preset", label: "Encoding preset", type: "string" },
  ],
}

const makeStore = (commandName: string | null) => {
  const store = createStore()
  store.set(commandHelpModalCommandAtom, commandName)
  return store
}

const wrapWithBridge = () => {
  window.mediaTools = window.mediaTools ?? {}
  window.mediaTools.COMMANDS = { ffmpeg: mockCommand } as never
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("CommandHelpModal", () => {
  it("renders nothing when closed", () => {
    const store = makeStore("ffmpeg")
    const { container } = render(
      <Provider store={store}>
        <CommandHelpModal isOpen={false} onClose={vi.fn()} />
      </Provider>,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when commandName atom is null", () => {
    const store = makeStore(null)
    const { container } = render(
      <Provider store={store}>
        <CommandHelpModal isOpen={true} onClose={vi.fn()} />
      </Provider>,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders the modal title with command name", () => {
    wrapWithBridge()
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal isOpen={true} onClose={vi.fn()} />
      </Provider>,
    )
    expect(screen.getByText(/Help:/)).toBeInTheDocument()
  })

  it("renders the command summary", () => {
    wrapWithBridge()
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal isOpen={true} onClose={vi.fn()} />
      </Provider>,
    )
    expect(screen.getByText("Encodes video with ffmpeg.")).toBeInTheDocument()
  })

  it("renders all field entries", () => {
    wrapWithBridge()
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal isOpen={true} onClose={vi.fn()} />
      </Provider>,
    )
    expect(screen.getByText("Input file")).toBeInTheDocument()
    expect(screen.getByText("Encoding preset")).toBeInTheDocument()
  })

  it("shows required badge for required fields", () => {
    wrapWithBridge()
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal isOpen={true} onClose={vi.fn()} />
      </Provider>,
    )
    expect(screen.getByText("required")).toBeInTheDocument()
  })

  it("calls onClose when close button is clicked", async () => {
    wrapWithBridge()
    const user = userEvent.setup()
    const onClose = vi.fn()
    const store = makeStore("ffmpeg")
    render(
      <Provider store={store}>
        <CommandHelpModal isOpen={true} onClose={onClose} />
      </Provider>,
    )
    await user.click(screen.getByRole("button", { name: /✕ close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("calls onClose when backdrop is clicked", async () => {
    wrapWithBridge()
    const user = userEvent.setup()
    const onClose = vi.fn()
    const store = makeStore("ffmpeg")
    const { container } = render(
      <Provider store={store}>
        <CommandHelpModal isOpen={true} onClose={onClose} />
      </Provider>,
    )
    const backdrop = container.querySelector(".fixed.inset-0") as HTMLElement
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
