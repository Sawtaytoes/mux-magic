import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import {
  addVariableAtom,
  variablesAtom,
} from "../../state/variablesAtom"
import type { Variable } from "../../types"
import { VariablesPanel } from "./VariablesPanel"

const makeVariable = (
  overrides: Partial<Variable> = {},
): Variable => ({
  id: "basePath",
  label: "Base Path",
  value: "/mnt/media",
  type: "path",
  ...overrides,
})

const renderPanel = (initialVariables: Variable[] = []) => {
  const store = createStore()
  store.set(variablesAtom, initialVariables)
  render(
    <Provider store={store}>
      <VariablesPanel />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

describe("VariablesPanel", () => {
  test("renders empty state when no variables exist", () => {
    renderPanel([])
    expect(screen.getByText(/no variables/i)).toBeInTheDocument()
  })

  test("renders a VariableCard for each variable in the atom", () => {
    renderPanel([
      makeVariable({ id: "v1", label: "Base Path" }),
      makeVariable({ id: "v2", label: "Output Path" }),
    ])
    expect(
      screen.getByDisplayValue("Base Path"),
    ).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("Output Path"),
    ).toBeInTheDocument()
  })

  test("renders a path variable card without errors", () => {
    const pathVariable = makeVariable({
      id: "pv1",
      type: "path",
      label: "Source",
    })
    renderPanel([pathVariable])
    expect(
      screen.getByText("path variable"),
    ).toBeInTheDocument()
  })

  test("Add Variable button opens type picker, then selecting a type adds the variable", async () => {
    const user = userEvent.setup()
    const store = renderPanel([])
    await user.click(
      screen.getByRole("button", { name: /add variable/i }),
    )
    await user.click(
      screen.getByRole("button", { name: /^path$/i }),
    )
    const variables = store.get(variablesAtom)
    expect(variables).toHaveLength(1)
    expect(variables[0].type).toBe("path")
  })

  test("type picker only shows path type when no variables exist", async () => {
    const user = userEvent.setup()
    renderPanel([])
    await user.click(
      screen.getByRole("button", { name: /add variable/i }),
    )
    expect(
      screen.getByRole("button", { name: /path/i }),
    ).toBeInTheDocument()
  })

  test("multiple variables: first has no remove button, second does", () => {
    renderPanel([
      makeVariable({ id: "v1", label: "First" }),
      makeVariable({ id: "v2", label: "Second" }),
    ])
    const removeButtons = screen.queryAllByTitle(
      /remove path variable/i,
    )
    expect(removeButtons).toHaveLength(1)
  })
})
