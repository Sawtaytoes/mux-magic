import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { pathsAtom } from "../state/pathsAtom"
import { stepsAtom } from "../state/stepsAtom"
import { YamlModal } from "./YamlModal"

const makeStep = (override = {}) => ({
  id: "step1",
  alias: "",
  command: "ffmpeg",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...override,
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("YamlModal", () => {
  it("renders nothing when closed", () => {
    const store = createStore()
    const { container } = render(
      <Provider store={store}>
        <YamlModal isOpen={false} onClose={vi.fn()} />
      </Provider>,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders the modal when open", () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <YamlModal isOpen={true} onClose={vi.fn()} />
      </Provider>,
    )
    expect(screen.getByText("YAML")).toBeInTheDocument()
  })

  it("shows no-steps placeholder when sequence is empty", () => {
    const store = createStore()
    store.set(stepsAtom, [])
    store.set(pathsAtom, [])
    render(
      <Provider store={store}>
        <YamlModal isOpen={true} onClose={vi.fn()} />
      </Provider>,
    )
    expect(screen.getByText(/# No steps yet/)).toBeInTheDocument()
  })

  it("shows serialized YAML for a non-empty sequence", () => {
    const store = createStore()
    store.set(stepsAtom, [makeStep()])
    store.set(pathsAtom, [{ id: "basePath", label: "basePath", value: "/media" }])
    render(
      <Provider store={store}>
        <YamlModal isOpen={true} onClose={vi.fn()} />
      </Provider>,
    )
    expect(screen.getByText(/command:/)).toBeInTheDocument()
  })

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const store = createStore()
    render(
      <Provider store={store}>
        <YamlModal isOpen={true} onClose={onClose} />
      </Provider>,
    )
    await user.click(screen.getByRole("button", { name: /✕ close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("calls onClose when the backdrop is clicked", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const store = createStore()
    const { container } = render(
      <Provider store={store}>
        <YamlModal isOpen={true} onClose={onClose} />
      </Provider>,
    )
    const backdrop = container.querySelector(".fixed.inset-0") as HTMLElement
    await user.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("does not close when inner content is clicked", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const store = createStore()
    render(
      <Provider store={store}>
        <YamlModal isOpen={true} onClose={onClose} />
      </Provider>,
    )
    await user.click(screen.getByText("YAML"))
    expect(onClose).not.toHaveBeenCalled()
  })

  it("copies YAML to clipboard when Copy is clicked", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(stepsAtom, [makeStep()])
    store.set(pathsAtom, [])
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    render(
      <Provider store={store}>
        <YamlModal isOpen={true} onClose={vi.fn()} />
      </Provider>,
    )
    await user.click(screen.getByRole("button", { name: /copy/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })
})
