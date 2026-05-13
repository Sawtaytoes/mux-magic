import {
  act,
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
  describe,
  expect,
  test,
  vi,
} from "vitest"
import type { Commands } from "../../commands/types"
import { loadModalOpenAtom } from "../../components/LoadModal/loadModalAtom"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import { LoadModal } from "./LoadModal"

// Minimal COMMANDS fixture — one command with one field
const mockCommands: Commands = {
  testCommand: {
    fields: [{ name: "inputPath", type: "path" }],
  },
}

const minimalYaml = `
- command: testCommand
  params:
    inputPath: /some/path
`.trim()

const canonicalYaml = `
paths:
  basePath:
    label: basePath
    value: /home/user
steps:
  - command: testCommand
    id: step1
    params:
      inputPath: /some/path
`.trim()

// Wraps the component with an isolated Jotai store so tests don't bleed state.
const renderModal = (isInitiallyOpen = false) => {
  const store = createStore()
  store.set(loadModalOpenAtom, isInitiallyOpen)
  store.set(commandsAtom, mockCommands)

  render(
    <Provider store={store}>
      <LoadModal />
    </Provider>,
  )

  return store
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ─── Visibility ───────────────────────────────────────────────────────────────

describe("LoadModal visibility", () => {
  test("renders nothing when the atom is false", () => {
    renderModal(false)
    expect(screen.queryByText("Load YAML")).toBeNull()
  })

  test("renders the modal when the atom is true", () => {
    renderModal(true)
    expect(
      screen.getByText("Load YAML"),
    ).toBeInTheDocument()
  })
})

// ─── Close interactions ───────────────────────────────────────────────────────

describe("LoadModal close interactions", () => {
  test("close button hides the modal", async () => {
    const user = userEvent.setup()
    renderModal(true)

    await user.click(
      screen.getByRole("button", { name: /close/i }),
    )

    expect(screen.queryByText("Load YAML")).toBeNull()
  })

  test("clicking the backdrop hides the modal", async () => {
    renderModal(true)

    fireEvent.click(
      screen.getByRole("dialog", { name: "Load YAML" })
        .parentElement as HTMLElement,
    )

    await waitFor(() =>
      expect(screen.queryByText("Load YAML")).toBeNull(),
    )
  })

  test("clicking inside the panel does not close the modal", async () => {
    const user = userEvent.setup()
    renderModal(true)

    // Click the instructional text — this is inside the panel, not the backdrop
    await user.click(
      screen.getByText(/paste your saved sequence/i),
    )

    expect(
      screen.getByText("Load YAML"),
    ).toBeInTheDocument()
  })

  test("Esc key hides the modal", async () => {
    const user = userEvent.setup()
    renderModal(true)

    await user.keyboard("{Escape}")

    expect(screen.queryByText("Load YAML")).toBeNull()
  })
})

// ClipboardEvent constructor in real browsers requires a DataTransfer object for
// clipboardData. We bypass that by dispatching a plain Event with a fake property.
const dispatchPaste = (text: string) => {
  const event = new Event("paste", {
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, "clipboardData", {
    value: { getData: (_type: string) => text },
  })
  document.dispatchEvent(event)
}

// ─── Paste handling ───────────────────────────────────────────────────────────

describe("LoadModal paste handling", () => {
  test("valid YAML paste loads steps and closes modal", async () => {
    const store = renderModal(true)

    dispatchPaste(minimalYaml)

    await waitFor(() =>
      expect(screen.queryByText("Load YAML")).toBeNull(),
    )
    const steps = store.get(stepsAtom)
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({
      command: "testCommand",
    })
  })

  test("canonical YAML with paths section loads paths correctly", async () => {
    const store = renderModal(true)

    dispatchPaste(canonicalYaml)

    const paths = store.get(pathsAtom)
    expect(paths).toHaveLength(1)
    expect(paths[0]).toMatchObject({
      id: "basePath",
      value: "/home/user",
    })
  })

  test("empty paste is ignored; modal stays open", () => {
    renderModal(true)

    dispatchPaste("   ")

    expect(
      screen.getByText("Load YAML"),
    ).toBeInTheDocument()
  })

  test("invalid YAML shows an error message and keeps modal open", async () => {
    renderModal(true)

    dispatchPaste("not: valid: yaml: {{{{")

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    )
    expect(
      screen.getByText("Load YAML"),
    ).toBeInTheDocument()
  })

  test("unknown command in YAML shows an error message", async () => {
    renderModal(true)

    dispatchPaste("- command: unknownCommand\n  params: {}")

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    )
    expect(
      screen.getByText(/unknown command/i),
    ).toBeInTheDocument()
  })

  test("paste after modal closes is ignored", async () => {
    const store = renderModal(true)

    // Close the modal; act() flushes the re-render AND the useEffect cleanup
    // (which removes the paste listener) before we continue.
    await act(async () => {
      store.set(loadModalOpenAtom, false)
    })

    // Listener is now detached — paste should be ignored
    dispatchPaste(minimalYaml)

    expect(store.get(stepsAtom)).toHaveLength(0)
  })
})
