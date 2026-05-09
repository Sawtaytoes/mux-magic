import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pathsAtom } from "../state/pathsAtom"
import { linkPickerStateAtom } from "../state/pickerAtoms"
import { stepsAtom } from "../state/stepsAtom"
import type { PathVar, Step } from "../types"
import { LinkPicker } from "./LinkPicker"

const TRIGGER_RECT = {
  left: 200,
  top: 200,
  right: 560,
  bottom: 224,
  width: 360,
  height: 24,
}

const makeStep = (id: string, command: string): Step => ({
  id,
  alias: "",
  command,
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

const makePath = (id: string, label: string, value: string): PathVar => ({
  id,
  label,
  value,
})

const renderPicker = (open = false) => {
  const store = createStore()

  store.set(stepsAtom, [
    makeStep("step-1", "copyFiles"),
    makeStep("step-2", "moveFiles"),
    makeStep("step-3", "addSubtitles"),
  ])
  store.set(pathsAtom, [
    makePath("basePath", "Base Path", "/home/user/videos"),
    makePath("outputPath", "Output Path", "/home/user/output"),
  ])

  if (open) {
    store.set(linkPickerStateAtom, {
      anchor: { stepId: "step-3", fieldName: "sourcePath" },
      triggerRect: TRIGGER_RECT,
    })
  }

  render(
    <Provider store={store}>
      <LinkPicker />
    </Provider>,
  )

  window.commandLabel = (name: string) => name
  window.setLink = vi.fn()
  window.refreshLinkPickerTrigger = vi.fn()

  return store
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true })
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("LinkPicker visibility", () => {
  it("renders nothing when atom is null", () => {
    renderPicker(false)
    expect(screen.queryByTestId("link-picker")).toBeNull()
  })

  it("renders picker when atom has state", () => {
    renderPicker(true)
    expect(screen.getByTestId("link-picker")).toBeInTheDocument()
  })
})

describe("LinkPicker items", () => {
  it("shows path variables", () => {
    renderPicker(true)
    expect(screen.getByText("Base Path")).toBeInTheDocument()
    expect(screen.getByText("Output Path")).toBeInTheDocument()
  })

  it("shows preceding steps (not the current or later steps)", () => {
    renderPicker(true)
    // step-3 is the anchor — only step-1 and step-2 should appear
    expect(screen.getByText(/Step 1: copyFiles/)).toBeInTheDocument()
    expect(screen.getByText(/Step 2: moveFiles/)).toBeInTheDocument()
    expect(screen.queryByText(/addSubtitles/)).toBeNull()
  })

  it("filters items by query", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.type(screen.getByPlaceholderText(/search locations/i), "base")

    expect(screen.getByText("Base Path")).toBeInTheDocument()
    expect(screen.queryByText("Output Path")).toBeNull()
  })
})

describe("LinkPicker selection", () => {
  it("clicking a path var calls setLink with the correct value", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.click(screen.getByText("Base Path"))

    expect(window.setLink).toHaveBeenCalledWith("step-3", "sourcePath", "path:basePath")
  })

  it("calls refreshLinkPickerTrigger after selection", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.click(screen.getByText("Base Path"))

    expect(window.refreshLinkPickerTrigger).toHaveBeenCalledWith("step-3", "sourcePath")
  })

  it("closes after selection", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.click(screen.getByText("Base Path"))

    expect(store.get(linkPickerStateAtom)).toBeNull()
  })
})

describe("LinkPicker keyboard", () => {
  it("Escape closes the picker", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.keyboard("{Escape}")

    expect(store.get(linkPickerStateAtom)).toBeNull()
  })
})
