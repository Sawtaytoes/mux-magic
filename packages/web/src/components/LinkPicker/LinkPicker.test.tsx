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
import type { Commands } from "../../commands/types"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { linkPickerStateAtom } from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type { PathVariable, Step } from "../../types"
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

const makePath = (
  id: string,
  label: string,
  value: string,
): PathVariable => ({
  id,
  label,
  value,
  type: "path",
})

const renderPicker = (isOpen = false) => {
  const store = createStore()

  store.set(stepsAtom, [
    makeStep("step-1", "copyFiles"),
    makeStep("step-2", "moveFiles"),
    makeStep("step-3", "addSubtitles"),
  ])
  store.set(pathsAtom, [
    makePath("basePath", "Base Path", "/home/user/videos"),
    makePath(
      "outputPath",
      "Output Path",
      "/home/user/output",
    ),
  ])

  if (isOpen) {
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

describe("LinkPicker visibility", () => {
  test("renders nothing when atom is null", () => {
    renderPicker(false)
    expect(
      screen.queryByRole("listbox", {
        name: "Link picker",
      }),
    ).toBeNull()
  })

  test("renders picker when atom has state", () => {
    renderPicker(true)
    expect(
      screen.getByRole("listbox", { name: "Link picker" }),
    ).toBeInTheDocument()
  })

  test("shows footer hint text", () => {
    renderPicker(true)
    expect(
      screen.getByText(
        /Don't see what you need\? Close this and type a path directly/,
      ),
    ).toBeInTheDocument()
  })
})

describe("LinkPicker items", () => {
  test("shows path variables", () => {
    renderPicker(true)
    expect(
      screen.getByText("Base Path"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Output Path"),
    ).toBeInTheDocument()
  })

  test("shows preceding steps (not the current or later steps)", () => {
    renderPicker(true)
    // step-3 is the anchor — only step-1 and step-2 should appear
    expect(
      screen.getByText(/Step 1: Copy Files/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Step 2: Move Files/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/addSubtitles/)).toBeNull()
  })

  test("filters items by query", async () => {
    const user = userEvent.setup()
    renderPicker(true)

    await user.type(
      screen.getByPlaceholderText(/search locations/i),
      "base",
    )

    expect(
      screen.getByText("Base Path"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Output Path")).toBeNull()
  })
})

describe("LinkPicker selection", () => {
  test("clicking a path var sets the link on the step", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.click(screen.getByText("Base Path"))

    const step3 = (store.get(stepsAtom) as Step[]).find(
      (step) => step.id === "step-3",
    )
    expect(step3?.links.sourcePath).toBe("basePath")
  })

  test("clicking a step item stores the object form, not a display string", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.click(screen.getByText(/Step 1: Copy Files/))

    const step3 = (store.get(stepsAtom) as Step[]).find(
      (step) => step.id === "step-3",
    )
    expect(step3?.links.sourcePath).toEqual({
      linkedTo: "step-1",
      output: "folder",
    })
  })

  test("closes after selection", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.click(screen.getByText("Base Path"))

    expect(store.get(linkPickerStateAtom)).toBeNull()
  })
})

describe("LinkPicker keyboard", () => {
  test("Escape closes the picker", async () => {
    const user = userEvent.setup()
    const store = renderPicker(true)

    await user.keyboard("{Escape}")

    expect(store.get(linkPickerStateAtom)).toBeNull()
  })
})

describe("LinkPicker named outputs", () => {
  const renderWithNamedOutputs = () => {
    const store = createStore()
    const commands: Commands = {
      copyFiles: {
        summary: "Copy files",
        tag: "File Operations",
        outputFolderName: "COPY-OUTPUT",
        outputs: [
          {
            name: "copiedSourcePaths",
            label: "Copied source paths",
          },
        ],
        fields: [
          {
            name: "sourcePath",
            type: "path",
            label: "Source Path",
            isRequired: true,
          },
        ],
      },
      deleteCopiedOriginals: {
        summary: "Delete originals",
        tag: "File Operations",
        outputFolderName: null,
        fields: [
          {
            name: "pathsToDelete",
            type: "stringArray",
            label: "Paths to Delete",
            isRequired: true,
          },
        ],
      },
    }
    store.set(stepsAtom, [
      makeStep("step-1", "copyFiles"),
      makeStep("step-2", "deleteCopiedOriginals"),
    ])
    store.set(pathsAtom, [])
    store.set(commandsAtom, commands)
    store.set(linkPickerStateAtom, {
      anchor: {
        stepId: "step-2",
        fieldName: "pathsToDelete",
      },
      triggerRect: TRIGGER_RECT,
    })

    render(
      <Provider store={store}>
        <LinkPicker />
      </Provider>,
    )

    return store
  }

  test("renders one row per named output in addition to the folder row", () => {
    renderWithNamedOutputs()
    expect(
      screen.getByText("Step 1: Copy Files"),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Step 1: Copy Files → Copied source paths/,
      ),
    ).toBeInTheDocument()
  })

  test("clicking the named-output row writes that output name to the link", async () => {
    const user = userEvent.setup()
    const store = renderWithNamedOutputs()

    await user.click(
      screen.getByText(
        /Step 1: Copy Files → Copied source paths/,
      ),
    )

    const step2 = (store.get(stepsAtom) as Step[]).find(
      (step) => step.id === "step-2",
    )
    expect(step2?.links.pathsToDelete).toEqual({
      linkedTo: "step-1",
      output: "copiedSourcePaths",
    })
  })
})

describe("LinkPicker step detail", () => {
  test("step item shows computed output path as detail when commands are loaded", () => {
    const store = createStore()
    const commands: Commands = {
      copyFiles: {
        summary: "Copy files",
        tag: "File Operations",
        outputFolderName: "COPY-OUTPUT",
        fields: [
          {
            name: "sourcePath",
            type: "path",
            label: "Source Path",
            isRequired: true,
          },
        ],
      },
    }
    store.set(stepsAtom, [
      makeStep("step-1", "copyFiles"),
      makeStep("step-3", "addSubtitles"),
    ])
    store.set(pathsAtom, [
      makePath(
        "basePath",
        "Base Path",
        "/home/user/videos",
      ),
    ])
    store.set(commandsAtom, commands)
    store.set(linkPickerStateAtom, {
      anchor: { stepId: "step-3", fieldName: "sourcePath" },
      triggerRect: TRIGGER_RECT,
    })

    render(
      <Provider store={store}>
        <LinkPicker />
      </Provider>,
    )

    expect(
      screen.getByText("COPY-OUTPUT"),
    ).toBeInTheDocument()
  })
})
