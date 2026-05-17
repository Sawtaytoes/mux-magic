import {
  cleanup,
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
import { commandsAtom } from "../../state/commandsAtom"
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
  // Exercises the "Flow Control" tag — a regression here would mean the
  // picker's tag list drifted out of sync with commands.ts (the bug that
  // briefly hid `exitIfEmpty` from the picker).
  exitIfEmpty: {
    tag: "Flow Control",
    summary: "Exit if folder is empty",
    fields: [],
  },
}

const renderPicker = (isOpen = false) => {
  const store = createStore()
  store.set(commandsAtom, mockCommands)
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
  if (isOpen) {
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
      screen.queryByRole("listbox", {
        name: "Command picker",
      }),
    ).toBeNull()
  })

  test("renders picker when atom has state", () => {
    renderPicker(true)
    expect(
      screen.getByRole("listbox", {
        name: "Command picker",
      }),
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
    expect(
      screen.getAllByText("exitIfEmpty").length,
    ).toBeGreaterThan(0)
  })

  test("includes Flow Control commands (TAG_ORDER must list every tag in commands.ts)", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.type(
      screen.getByPlaceholderText(/search commands/i),
      "exit",
    )

    expect(
      screen.getAllByText("exitIfEmpty").length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByText(/no commands match/i),
    ).toBeNull()
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

    await waitFor(() => {
      expect(
        (store.get(stepsAtom)[0] as Step).command,
      ).toBe("copyFiles")
    })
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
