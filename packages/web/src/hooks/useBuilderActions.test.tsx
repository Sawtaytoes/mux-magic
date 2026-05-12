import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"

import {
  canRedoAtom,
  canUndoAtom,
  redoStackAtom,
  undoStackAtom,
} from "../state/historyAtoms"
import { pathsAtom } from "../state/pathsAtom"
import { useBuilderActions } from "./useBuilderActions"

afterEach(cleanup)

const Harness = () => {
  const { undo, redo, addPath, setPathValue } =
    useBuilderActions()
  return (
    <>
      <button onClick={addPath}>Add Path</button>
      <button
        onClick={() => setPathValue("test", "/v1")}
      >
        Set V1
      </button>
      <button
        onClick={() => setPathValue("test", "/v2")}
      >
        Set V2
      </button>
      <button
        onClick={() => setPathValue("test", "/v3")}
      >
        Set V3
      </button>
      <button onClick={() => void undo()}>Undo</button>
      <button onClick={() => void redo()}>Redo</button>
    </>
  )
}

const renderWithStore = (
  store: ReturnType<typeof createStore>,
) =>
  render(
    <Provider store={store}>
      <Harness />
    </Provider>,
  )

// Pre-seeding a path with a real value forces toYamlStr to
// produce actual YAML instead of "# No steps yet", which is
// required for applySnapshot to restore state correctly.
const seedTestPath = (
  store: ReturnType<typeof createStore>,
) => {
  store.set(pathsAtom, [
    { id: "test", label: "test", value: "/initial" },
  ])
}

describe("pushHistory", () => {
  test("adds a snapshot to the undo stack", async () => {
    const store = createStore()
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Add Path" }),
    )
    expect(store.get(undoStackAtom)).toHaveLength(1)
  })

  test("sets canUndo to true", async () => {
    const store = createStore()
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Add Path" }),
    )
    expect(store.get(canUndoAtom)).toBe(true)
  })

  test("clears the redo stack and canRedo", async () => {
    const store = createStore()
    store.set(redoStackAtom, ["# stale-snapshot"])
    store.set(canRedoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Add Path" }),
    )
    expect(store.get(redoStackAtom)).toHaveLength(0)
    expect(store.get(canRedoAtom)).toBe(false)
  })
})

describe("undo", () => {
  test("does nothing when the undo stack is empty", async () => {
    const store = createStore()
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    expect(store.get(undoStackAtom)).toHaveLength(0)
    expect(store.get(canUndoAtom)).toBe(false)
  })

  test("pops from the undo stack", async () => {
    const store = createStore()
    store.set(undoStackAtom, ["# snap"])
    store.set(canUndoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    expect(store.get(undoStackAtom)).toHaveLength(0)
  })

  test("pushes current state onto the redo stack", async () => {
    const store = createStore()
    store.set(undoStackAtom, ["# snap"])
    store.set(canUndoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    expect(store.get(redoStackAtom)).toHaveLength(1)
  })

  test("sets canRedo to true", async () => {
    const store = createStore()
    store.set(undoStackAtom, ["# snap"])
    store.set(canUndoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    await waitFor(() => {
      expect(store.get(canRedoAtom)).toBe(true)
    })
  })

  test("sets canUndo to false when the stack is exhausted", async () => {
    const store = createStore()
    store.set(undoStackAtom, ["# snap"])
    store.set(canUndoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    await waitFor(() => {
      expect(store.get(canUndoAtom)).toBe(false)
    })
  })

  test("keeps canUndo true when more snapshots remain", async () => {
    const store = createStore()
    store.set(undoStackAtom, ["# snap1", "# snap2"])
    store.set(canUndoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    await waitFor(() => {
      expect(store.get(canUndoAtom)).toBe(true)
    })
  })

  test("restores path state from the captured snapshot", async () => {
    const store = createStore()
    seedTestPath(store)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Set V1" }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    await waitFor(() => {
      expect(
        store
          .get(pathsAtom)
          .some((path) => path.value === "/initial"),
      ).toBe(true)
    })
  })
})

describe("redo", () => {
  test("does nothing when the redo stack is empty", async () => {
    const store = createStore()
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Redo" }),
    )
    expect(store.get(redoStackAtom)).toHaveLength(0)
    expect(store.get(canRedoAtom)).toBe(false)
  })

  test("pops from the redo stack", async () => {
    const store = createStore()
    store.set(redoStackAtom, ["# snap"])
    store.set(canRedoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Redo" }),
    )
    expect(store.get(redoStackAtom)).toHaveLength(0)
  })

  test("pushes current state onto the undo stack", async () => {
    const store = createStore()
    store.set(redoStackAtom, ["# snap"])
    store.set(canRedoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Redo" }),
    )
    expect(store.get(undoStackAtom)).toHaveLength(1)
  })

  test("sets canUndo to true", async () => {
    const store = createStore()
    store.set(redoStackAtom, ["# snap"])
    store.set(canRedoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Redo" }),
    )
    await waitFor(() => {
      expect(store.get(canUndoAtom)).toBe(true)
    })
  })

  test("sets canRedo to false when the stack is exhausted", async () => {
    const store = createStore()
    store.set(redoStackAtom, ["# snap"])
    store.set(canRedoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Redo" }),
    )
    await waitFor(() => {
      expect(store.get(canRedoAtom)).toBe(false)
    })
  })

  test("restores path state from the captured snapshot", async () => {
    const store = createStore()
    seedTestPath(store)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Set V1" }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    await waitFor(() =>
      expect(
        store
          .get(pathsAtom)
          .some((path) => path.value === "/initial"),
      ).toBe(true),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Redo" }),
    )
    await waitFor(() => {
      expect(
        store
          .get(pathsAtom)
          .some((path) => path.value === "/v1"),
      ).toBe(true)
    })
  })
})

describe("undo/redo interaction", () => {
  test("a new action after undo clears the redo stack", async () => {
    const store = createStore()
    store.set(undoStackAtom, ["# snap"])
    store.set(canUndoAtom, true)
    renderWithStore(store)
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    await waitFor(() =>
      expect(store.get(canRedoAtom)).toBe(true),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Add Path" }),
    )
    expect(store.get(redoStackAtom)).toHaveLength(0)
    expect(store.get(canRedoAtom)).toBe(false)
  })

  test("three pushes then three undos then three redos restores stack lengths", async () => {
    const store = createStore()
    seedTestPath(store)
    renderWithStore(store)

    await userEvent.click(
      screen.getByRole("button", { name: "Set V1" }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Set V2" }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Set V3" }),
    )
    expect(store.get(undoStackAtom)).toHaveLength(3)
    expect(store.get(canUndoAtom)).toBe(true)

    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    await waitFor(() =>
      expect(store.get(undoStackAtom)).toHaveLength(2),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    await waitFor(() =>
      expect(store.get(undoStackAtom)).toHaveLength(1),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Undo" }),
    )
    await waitFor(() => {
      expect(store.get(undoStackAtom)).toHaveLength(0)
      expect(store.get(canUndoAtom)).toBe(false)
      expect(store.get(redoStackAtom)).toHaveLength(3)
    })

    await userEvent.click(
      screen.getByRole("button", { name: "Redo" }),
    )
    await waitFor(() =>
      expect(store.get(redoStackAtom)).toHaveLength(2),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Redo" }),
    )
    await waitFor(() =>
      expect(store.get(redoStackAtom)).toHaveLength(1),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Redo" }),
    )
    await waitFor(() => {
      expect(store.get(redoStackAtom)).toHaveLength(0)
      expect(store.get(canRedoAtom)).toBe(false)
      expect(store.get(undoStackAtom)).toHaveLength(3)
      expect(store.get(canUndoAtom)).toBe(true)
    })
  })
})
