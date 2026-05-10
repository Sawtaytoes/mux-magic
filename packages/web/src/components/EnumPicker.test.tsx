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
  it,
  vi,
} from "vitest"
import { enumPickerStateAtom } from "../state/pickerAtoms"
import { EnumPicker } from "./EnumPicker"

const TRIGGER_RECT = {
  left: 100,
  top: 200,
  right: 400,
  bottom: 224,
  width: 300,
  height: 24,
}

const EPISODE_TYPE_OPTIONS = [
  { value: "regular", label: "Regular (type=1)" },
  { value: "specials", label: "Specials (S, type=2)" },
  {
    value: "credits",
    label: "Credits / OP / ED (C, type=3)",
  },
]

const mockCommands = {
  setEpisodeType: {
    tag: "Naming Operations",
    summary: "Set episode type",
    fields: [
      {
        name: "episodeType",
        type: "enum",
        label: "Episode Type",
        default: "regular",
        options: EPISODE_TYPE_OPTIONS,
      },
    ],
  },
}

const renderPicker = (
  open = false,
  currentValue?: string,
) => {
  const store = createStore()
  if (open) {
    store.set(enumPickerStateAtom, {
      anchor: {
        stepId: "step-1",
        fieldName: "episodeType",
      },
      triggerRect: TRIGGER_RECT,
    })
  }
  render(
    <Provider store={store}>
      <EnumPicker />
    </Provider>,
  )
  window.mediaTools = {
    COMMANDS: mockCommands,
    findStepById: () => ({
      command: "setEpisodeType",
      params: currentValue
        ? { episodeType: currentValue }
        : {},
    }),
    renderAll: vi.fn(),
  }
  window.setParam = vi.fn()
  return store
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
})

describe("EnumPicker visibility", () => {
  it("renders nothing when atom is null", () => {
    renderPicker(false)
    expect(screen.queryByTestId("enum-picker")).toBeNull()
  })

  it("renders picker when atom has state", () => {
    renderPicker(true)
    expect(
      screen.getByTestId("enum-picker"),
    ).toBeInTheDocument()
  })
})

describe("EnumPicker items", () => {
  it("shows all options initially", () => {
    renderPicker(true)
    expect(
      screen.getByText("Regular (type=1)"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Specials (S, type=2)"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Credits / OP / ED (C, type=3)"),
    ).toBeInTheDocument()
  })

  it("filters options by query", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.type(
      screen.getByPlaceholderText(/search options/i),
      "special",
    )

    expect(
      screen.getByText("Specials (S, type=2)"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Regular (type=1)"),
    ).toBeNull()
  })

  it("shows empty state when nothing matches", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.type(
      screen.getByPlaceholderText(/search options/i),
      "zzznomatch",
    )

    expect(
      screen.getByText(/no options match/i),
    ).toBeInTheDocument()
  })
})

describe("EnumPicker selection", () => {
  it("clicking an option calls setParam", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.click(
      screen.getByText("Specials (S, type=2)"),
    )

    expect(window.setParam).toHaveBeenCalledWith(
      "step-1",
      "episodeType",
      "specials",
    )
  })

  it("closes after selection", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.click(screen.getByText("Regular (type=1)"))

    expect(store.get(enumPickerStateAtom)).toBeNull()
  })
})

describe("EnumPicker keyboard", () => {
  it("Escape closes the picker", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.keyboard("{Escape}")

    expect(store.get(enumPickerStateAtom)).toBeNull()
  })

  it("Enter selects the active item", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.type(
      screen.getByPlaceholderText(/search options/i),
      "credits",
    )
    await user.keyboard("{Enter}")

    expect(window.setParam).toHaveBeenCalledWith(
      "step-1",
      "episodeType",
      "credits",
    )
  })
})
