import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pathPickerStateAtom } from "../state/pickerAtoms"
import { PathPicker } from "./PathPicker"

const TRIGGER_RECT = {
  left: 100,
  top: 200,
  right: 480,
  bottom: 224,
  width: 380,
  height: 24,
}

const makeMockInput = (value = "/home/user/") => {
  const input = document.createElement("input")
  input.value = value
  // Give the input a non-zero getBoundingClientRect so position works
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 200,
    right: 480,
    bottom: 224,
    width: 380,
    height: 24,
    x: 100,
    y: 200,
    toJSON: () => ({}),
  } as DOMRect)
  return input
}

const mockEntries = [
  { name: "Documents", isDirectory: true },
  { name: "Downloads", isDirectory: true },
  { name: "Pictures", isDirectory: true },
  { name: "readme.txt", isDirectory: false },
]

const renderPicker = (initialEntries = mockEntries) => {
  const fetchMock = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ entries: initialEntries, separator: "/" }),
  })
  global.fetch = fetchMock

  const input = makeMockInput("/home/user/")
  const store = createStore()
  store.set(pathPickerStateAtom, {
    inputElement: input,
    target: { mode: "step", stepId: "step-1", fieldName: "sourcePath" },
    parentPath: "/home/user",
    query: "",
    triggerRect: TRIGGER_RECT,
    entries: null,
    error: null,
    activeIndex: 0,
    matches: null,
    separator: "/",
    cachedParentPath: null,
    requestToken: 0,
    debounceTimerId: null,
  })

  render(
    <Provider store={store}>
      <PathPicker />
    </Provider>,
  )

  window.setParam = vi.fn()

  return { store, fetchMock, input }
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true })
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("PathPicker visibility", () => {
  it("renders nothing when atom is null", () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <PathPicker />
      </Provider>,
    )
    expect(screen.queryByTestId("path-picker")).toBeNull()
  })

  it("renders picker when atom has state", () => {
    renderPicker()
    expect(screen.getByTestId("path-picker")).toBeInTheDocument()
  })

  it("shows loading state before fetch completes", () => {
    vi.fn().mockReturnValue(new Promise(() => {}))
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))
    renderPicker([])
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})

describe("PathPicker directory listing", () => {
  it("shows directories after fetch", async () => {
    renderPicker()

    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument()
      expect(screen.getByText("Downloads")).toBeInTheDocument()
      expect(screen.getByText("Pictures")).toBeInTheDocument()
    })
  })

  it("does not show non-directory entries", async () => {
    renderPicker()

    await waitFor(() => {
      expect(screen.queryByText("readme.txt")).toBeNull()
    })
  })
})

describe("PathPicker fetch error", () => {
  it("shows error message when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))
    const input = makeMockInput()
    const store = createStore()
    store.set(pathPickerStateAtom, {
      inputElement: input,
      target: { mode: "step", stepId: "step-1", fieldName: "sourcePath" },
      parentPath: "/bad/path",
      query: "",
      triggerRect: TRIGGER_RECT,
      entries: null,
      error: null,
      activeIndex: 0,
      matches: null,
      separator: "/",
      cachedParentPath: null,
      requestToken: 0,
      debounceTimerId: null,
    })

    render(
      <Provider store={store}>
        <PathPicker />
      </Provider>,
    )

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument()
    })
  })
})

describe("PathPicker selection", () => {
  it("clicking a directory calls setParam with new path", async () => {
    renderPicker()

    await waitFor(() => screen.getByText("Documents"))
    await userEvent.click(screen.getByText("Documents"))

    expect(window.setParam).toHaveBeenCalledWith("step-1", "sourcePath", "/home/user/Documents/")
  })
})
