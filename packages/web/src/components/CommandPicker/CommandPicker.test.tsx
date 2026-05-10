import {
  cleanup,
  render,
  screen,
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
import { commandPickerStateAtom } from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { CommandPicker } from "./CommandPicker"

const TRIGGER_RECT = {
  left: 100,
  top: 200,
  right: 440,
  bottom: 224,
  width: 340,
  height: 24,
}

const mockCommands = {
  makeDirectory: {
    tag: "File Operations",
    summary: "Create a directory",
    fields: [],
  },
  copyFiles: {
    tag: "File Operations",
    summary: "Copy files",
    fields: [],
  },
  addSubtitles: {
    tag: "Subtitle Operations",
    summary: "Add subtitles",
    fields: [],
  },
}

const renderPicker = (open = false) => {
  const store = createStore()
  store.set(stepsAtom, [
    {
      id: "step-1",
      alias: "",
      command: "",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    },
  ])
  if (open) {
    store.set(commandPickerStateAtom, {
      anchor: { stepId: "step-1" },
      triggerRect: TRIGGER_RECT,
    })
  }
  render(
    <Provider store={store}>
      <CommandPicker />
    </Provider>,
  )
  return store
}

beforeEach(() => {
  window.mediaTools = {
    COMMANDS: mockCommands,
    findStepById: () => ({ command: "copyFiles" }),
  }
  window.commandLabel = (name: string) => name
  // jsdom doesn't implement innerWidth/innerHeight by default
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
})

describe("CommandPicker visibility", () => {
  test("renders nothing when atom is null", () => {
    renderPicker(false)
    expect(
      screen.queryByTestId("command-picker"),
    ).toBeNull()
  })

  test("renders picker when atom has state", () => {
    renderPicker(true)
    expect(
      screen.getByTestId("command-picker"),
    ).toBeInTheDocument()
  })
})

describe("CommandPicker filtering", () => {
  test("shows all commands initially", () => {
    renderPicker(true)
    expect(
      screen.getAllByText("makeDirectory").length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText("copyFiles").length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText("addSubtitles").length,
    ).toBeGreaterThan(0)
  })

  test("filters commands by query", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.type(
      screen.getByPlaceholderText(/search commands/i),
      "copy",
    )

    expect(
      screen.getAllByText("copyFiles").length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryAllByText("makeDirectory"),
    ).toHaveLength(0)
  })

  test("shows empty state when no commands match", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.type(
      screen.getByPlaceholderText(/search commands/i),
      "zzznomatch",
    )

    expect(
      screen.getByText(/no commands match/i),
    ).toBeInTheDocument()
  })
})

describe("CommandPicker keyboard navigation", () => {
  test("Escape closes the picker", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.keyboard("{Escape}")

    expect(store.get(commandPickerStateAtom)).toBeNull()
  })

  test("Enter selects the active item", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    // Filter to a single result then press Enter
    await user.type(
      screen.getByPlaceholderText(/search commands/i),
      "copy",
    )
    await user.keyboard("{Enter}")

    expect((store.get(stepsAtom)[0] as Step).command).toBe(
      "copyFiles",
    )
  })
})

describe("CommandPicker item selection", () => {
  test("clicking an item calls changeCommand with the correct args", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.click(
      screen.getAllByText("makeDirectory")[0],
    )

    expect((store.get(stepsAtom)[0] as Step).command).toBe(
      "makeDirectory",
    )
  })

  test("closes the picker after selection", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.click(
      screen.getAllByText("makeDirectory")[0],
    )

    expect(store.get(commandPickerStateAtom)).toBeNull()
  })
})
