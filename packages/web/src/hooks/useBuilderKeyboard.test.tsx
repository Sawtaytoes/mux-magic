import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"

import {
  canRedoAtom,
  canUndoAtom,
  redoStackAtom,
  type Snapshot,
  undoStackAtom,
} from "../state/historyAtoms"
import { useBuilderKeyboard } from "./useBuilderKeyboard"

afterEach(cleanup)

const emptySnapshot: Snapshot = {
  steps: [],
  paths: [],
  stepCounter: 0,
  threadCount: null,
}

const KeyboardHarness = () => {
  useBuilderKeyboard()
  return (
    <div>
      <input data-testid="text-input" />
      <textarea data-testid="text-area" />
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
