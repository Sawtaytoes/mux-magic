import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"

import type { Commands } from "../commands/types"
import { commandsAtom } from "../state/commandsAtom"
import {
  canRedoAtom,
  canUndoAtom,
  redoStackAtom,
  type Snapshot,
  undoStackAtom,
} from "../state/historyAtoms"
import { stepsAtom } from "../state/stepsAtom"
import { useBuilderKeyboard } from "./useBuilderKeyboard"

afterEach(cleanup)

const emptySnapshot: Snapshot = {
  steps: [],
  paths: [],
}

const commands: Commands = {
  testCommand: {
    fields: [{ name: "inputPath", type: "path" }],
  },
}

const yamlText = [
  "steps:",
  "  - id: pasted-step",
  "    command: testCommand",
  "    params:",
  "      inputPath: /media/new-folder",
].join("\n")

const paste = ({
  target,
  text,
}: {
  target: Element
  text: string
}) => {
  const clipboardData = new DataTransfer()
  clipboardData.setData("text/plain", text)
  fireEvent(
    target,
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData,
    }),
  )
}

const KeyboardHarness = () => {
  useBuilderKeyboard()
  return (
    <div>
      <input data-testid="text-input" />
      <textarea data-testid="text-area" />
      <div contentEditable data-testid="rich-text-editor" />
    </div>
  )
}

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <KeyboardHarness />
    </Provider>,
  )

describe("Ctrl+Z", () => {
  test("triggers undo", async () => {
    const store = createStore()
    store.set(undoStackAtom, [emptySnapshot])
    store.set(canUndoAtom, true)
    renderWithStore(store)
    await userEvent.keyboard("{Control>}z{/Control}")
    expect(store.get(undoStackAtom)).toHaveLength(0)
    expect(store.get(canRedoAtom)).toBe(true)
  })

  test("is blocked when an input is focused", async () => {
    const store = createStore()
    store.set(undoStackAtom, [emptySnapshot])
    store.set(canUndoAtom, true)
    renderWithStore(store)
    await userEvent.click(screen.getByTestId("text-input"))
    await userEvent.keyboard("{Control>}z{/Control}")
    expect(store.get(undoStackAtom)).toHaveLength(1)
  })

  test("is blocked when a textarea is focused", async () => {
    const store = createStore()
    store.set(undoStackAtom, [emptySnapshot])
    store.set(canUndoAtom, true)
    renderWithStore(store)
    await userEvent.click(screen.getByTestId("text-area"))
    await userEvent.keyboard("{Control>}z{/Control}")
    expect(store.get(undoStackAtom)).toHaveLength(1)
  })
})

describe("Ctrl+Shift+Z", () => {
  test("triggers redo", async () => {
    const store = createStore()
    store.set(redoStackAtom, [emptySnapshot])
    store.set(canRedoAtom, true)
    renderWithStore(store)
    await userEvent.keyboard(
      "{Control>}{Shift>}z{/Shift}{/Control}",
    )
    expect(store.get(redoStackAtom)).toHaveLength(0)
    expect(store.get(canUndoAtom)).toBe(true)
  })
})

describe("Ctrl+Y", () => {
  test("triggers redo", async () => {
    const store = createStore()
    store.set(redoStackAtom, [emptySnapshot])
    store.set(canRedoAtom, true)
    renderWithStore(store)
    await userEvent.keyboard("{Control>}y{/Control}")
    expect(store.get(redoStackAtom)).toHaveLength(0)
    expect(store.get(canUndoAtom)).toBe(true)
  })
})

describe("paste", () => {
  test("loads valid Mux-Magic YAML outside an editable control", () => {
    const store = createStore()
    store.set(commandsAtom, commands)
    renderWithStore(store)

    paste({ target: document.body, text: yamlText })

    expect(store.get(stepsAtom)).toHaveLength(1)
    expect(store.get(stepsAtom)[0]).toMatchObject({
      id: "pasted-step",
      command: "testCommand",
      params: { inputPath: "/media/new-folder" },
    })
  })

  test("does not intercept paste in an input", () => {
    const store = createStore()
    store.set(commandsAtom, commands)
    renderWithStore(store)

    paste({
      target: screen.getByTestId("text-input"),
      text: yamlText,
    })

    expect(store.get(stepsAtom)).toHaveLength(0)
  })

  test("does not intercept paste in a textarea", () => {
    const store = createStore()
    store.set(commandsAtom, commands)
    renderWithStore(store)

    paste({
      target: screen.getByTestId("text-area"),
      text: yamlText,
    })

    expect(store.get(stepsAtom)).toHaveLength(0)
  })

  test("does not intercept paste in a rich-text editor", () => {
    const store = createStore()
    store.set(commandsAtom, commands)
    renderWithStore(store)

    paste({
      target: screen.getByTestId("rich-text-editor"),
      text: yamlText,
    })

    expect(store.get(stepsAtom)).toHaveLength(0)
  })

  test("ignores YAML that is not a Mux-Magic sequence", () => {
    const store = createStore()
    store.set(commandsAtom, commands)
    renderWithStore(store)

    paste({
      target: document.body,
      text: "automation:\n  alias: Hall light",
    })

    expect(store.get(stepsAtom)).toHaveLength(0)
  })
})
