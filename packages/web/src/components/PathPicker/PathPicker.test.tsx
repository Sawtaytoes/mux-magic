import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { pathPickerStateAtom } from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
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

const renderPicker = (
  initialEntries = mockEntries,
  fetchOverride?: ReturnType<typeof vi.fn>,
) => {
  const fetchMock =
    fetchOverride ??
    vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          entries: initialEntries,
          separator: "/",
        }),
    })
  vi.stubGlobal("fetch", fetchMock)

  const input = makeMockInput("/home/user/")
  const store = createStore()

  store.set(stepsAtom, [
    {
      id: "step-1",
      alias: "",
      command: "copyFiles",
      params: { sourcePath: "/home/user/" },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  ])

  store.set(pathPickerStateAtom, {
    inputElement: input,
    target: {
      mode: "step",
      stepId: "step-1",
      fieldName: "sourcePath",
    },
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

  return { store, fetchMock, input }
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: 1200,
    configurable: true,
  })
  Object.defineProperty(window, "innerHeight", {
    value: 800,
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("PathPicker visibility", () => {
  test("renders nothing when atom is null", () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <PathPicker />
      </Provider>,
    )
    expect(screen.queryByTestId("path-picker")).toBeNull()
  })

  test("renders picker when atom has state", () => {
    renderPicker()
    expect(
      screen.getByTestId("path-picker"),
    ).toBeInTheDocument()
  })

  test("shows loading state before fetch completes", () => {
    const pendingFetch = vi
      .fn()
      .mockReturnValue(new Promise(() => {}))
    renderPicker([], pendingFetch)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})

describe("PathPicker directory listing", () => {
  test("shows directories after fetch", async () => {
    renderPicker()

    await waitFor(() => {
      expect(
        screen.getByText("Documents"),
      ).toBeInTheDocument()
      expect(
        screen.getByText("Downloads"),
      ).toBeInTheDocument()
      expect(
        screen.getByText("Pictures"),
      ).toBeInTheDocument()
    })
  })

  test("does not show non-directory entries", async () => {
    renderPicker()

    await waitFor(() => {
      expect(screen.queryByText("readme.txt")).toBeNull()
    })
  })
})

describe("PathPicker fetch error", () => {
  test("shows error message when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    )
    const input = makeMockInput()
    const store = createStore()
    store.set(pathPickerStateAtom, {
      inputElement: input,
      target: {
        mode: "step",
        stepId: "step-1",
        fieldName: "sourcePath",
      },
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
      expect(
        screen.getByText("Network error"),
      ).toBeInTheDocument()
    })
  })
})

describe("PathPicker selection", () => {
  test("clicking a directory updates setParamAtom with new path", async () => {
    const { store } = renderPicker()

    await waitFor(() => screen.getByText("Documents"))
    await userEvent.click(screen.getByText("Documents"))

    const steps = store.get(stepsAtom)
    const step = steps.find(
      (item) => "id" in item && item.id === "step-1",
    ) as { params: Record<string, unknown> } | undefined
    expect(step?.params.sourcePath).toBe(
      "/home/user/Documents/",
    )
  })
})

describe("PathPicker keyboard navigation", () => {
  test("Enter selects the active directory entry", async () => {
    const { store, input } = renderPicker()

    await waitFor(() => screen.getByText("Documents"))

    fireEvent.keyDown(input, { key: "Enter" })

    const steps = store.get(stepsAtom)
    const step = steps.find(
      (item) => "id" in item && item.id === "step-1",
    ) as { params: Record<string, unknown> } | undefined
    expect(step?.params.sourcePath).toBe(
      "/home/user/Documents/",
    )
  })

  test("Tab selects the active directory entry", async () => {
    const { store, input } = renderPicker()

    await waitFor(() => screen.getByText("Documents"))

    fireEvent.keyDown(input, { key: "Tab" })

    const steps = store.get(stepsAtom)
    const step = steps.find(
      (item) => "id" in item && item.id === "step-1",
    ) as { params: Record<string, unknown> } | undefined
    expect(step?.params.sourcePath).toBe(
      "/home/user/Documents/",
    )
  })

  test("Escape closes the picker without selecting", async () => {
    const { store, input } = renderPicker()

    await waitFor(() => screen.getByText("Documents"))

    fireEvent.keyDown(input, { key: "Escape" })

    expect(store.get(pathPickerStateAtom)).toBeNull()
    await waitFor(() =>
      expect(
        screen.queryByTestId("path-picker"),
      ).not.toBeInTheDocument(),
    )
  })

  test("ArrowDown moves activeIndex to the next entry", async () => {
    const { store, input } = renderPicker()

    await waitFor(() => screen.getByText("Documents"))

    fireEvent.keyDown(input, { key: "ArrowDown" })

    expect(
      store.get(pathPickerStateAtom)?.activeIndex,
    ).toBe(1)
  })

  test("ArrowUp wraps activeIndex to the last entry", async () => {
    const { store, input } = renderPicker()

    await waitFor(() => screen.getByText("Documents"))

    fireEvent.keyDown(input, { key: "ArrowUp" })

    // 3 directory entries (Documents, Downloads, Pictures); wrap 0 → 2
    expect(
      store.get(pathPickerStateAtom)?.activeIndex,
    ).toBe(2)
  })
})
