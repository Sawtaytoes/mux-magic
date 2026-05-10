import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import { yamlModalOpenAtom } from "../../state/uiAtoms"
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

const renderModal = (initialOpen = false) => {
  const store = createStore()
  store.set(yamlModalOpenAtom, initialOpen)
  render(
    <Provider store={store}>
      <YamlModal />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("YamlModal", () => {
  it("renders nothing when closed", () => {
    const { container } = (() => {
      const store = createStore()
      return render(
        <Provider store={store}>
          <YamlModal />
        </Provider>,
      )
    })()
    expect(container.firstChild).toBeNull()
  })

  it("renders the modal when open", () => {
    renderModal(true)
    expect(screen.getByText("YAML")).toBeInTheDocument()
  })

  it("shows no-steps placeholder when sequence is empty", () => {
    const store = createStore()
    store.set(yamlModalOpenAtom, true)
    store.set(stepsAtom, [])
    store.set(pathsAtom, [])
    render(
      <Provider store={store}>
        <YamlModal />
      </Provider>,
    )
    expect(
      screen.getByText(/# No steps yet/),
    ).toBeInTheDocument()
  })

  it("shows serialized YAML for a non-empty sequence", () => {
    const store = createStore()
    store.set(yamlModalOpenAtom, true)
    store.set(stepsAtom, [makeStep()])
    store.set(pathsAtom, [
      {
        id: "basePath",
        label: "basePath",
        value: "/media",
      },
    ])
    render(
      <Provider store={store}>
        <YamlModal />
      </Provider>,
    )
    expect(screen.getByText(/command:/)).toBeInTheDocument()
  })

  it("close button sets atom to false", async () => {
    const user = userEvent.setup()
    const store = renderModal(true)

    await user.click(
      screen.getByRole("button", { name: /✕ close/i }),
    )

    expect(store.get(yamlModalOpenAtom)).toBe(false)
    expect(screen.queryByText("YAML")).toBeNull()
  })

  it("backdrop click sets atom to false", async () => {
    const user = userEvent.setup()
    const store = renderModal(true)

    await user.click(
      screen.getByTestId("yaml-modal-backdrop"),
    )

    expect(store.get(yamlModalOpenAtom)).toBe(false)
  })

  it("clicking inner content does not close the modal", async () => {
    const user = userEvent.setup()
    const store = renderModal(true)

    await user.click(screen.getByText("YAML"))

    expect(store.get(yamlModalOpenAtom)).toBe(true)
  })

  it("copies YAML to clipboard when Copy is clicked", async () => {
    const user = userEvent.setup()
    const store = createStore()
    store.set(yamlModalOpenAtom, true)
    store.set(stepsAtom, [makeStep()])
    store.set(pathsAtom, [])
    vi.spyOn(
      navigator.clipboard,
      "writeText",
    ).mockResolvedValue(undefined)
    render(
      <Provider store={store}>
        <YamlModal />
      </Provider>,
    )
    await user.click(
      screen.getByRole("button", { name: /copy/i }),
    )
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })
})
