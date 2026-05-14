import {
  cleanup,
  render,
  screen,
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
import { variablesAtom } from "../../state/variablesAtom"
import type { Variable } from "../../types"
import { VariableCard } from "./VariableCard"

const makeVariable = (
  overrides: Partial<Variable> = {},
): Variable => ({
  id: "basePath",
  label: "Base Path",
  value: "/mnt/media",
  type: "path",
  ...overrides,
})

const renderCard = (variable: Variable, isFirst = true) => {
  const store = createStore()
  store.set(variablesAtom, [variable])
  render(
    <Provider store={store}>
      <VariableCard variable={variable} isFirst={isFirst} />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("VariableCard", () => {
  test("renders the label input with current value", () => {
    renderCard(makeVariable({ label: "Base Path" }))
    expect(
      screen.getByDisplayValue("Base Path"),
    ).toBeInTheDocument()
  })

  test("renders the value input with current path", () => {
    renderCard(makeVariable({ value: "/mnt/media" }))
    expect(
      screen.getByDisplayValue("/mnt/media"),
    ).toBeInTheDocument()
  })

  test("does not show remove button for first variable", () => {
    renderCard(makeVariable(), true)
    expect(
      screen.queryByTitle(/remove path variable/i),
    ).toBeNull()
  })

  test("shows remove button for non-first variable", () => {
    renderCard(makeVariable({ id: "extraPath" }), false)
    expect(
      screen.getByTitle(/remove path variable/i),
    ).toBeInTheDocument()
  })

  test("updates label in atom on change", async () => {
    const user = userEvent.setup({ delay: null })
    const store = renderCard(
      makeVariable({ label: "Base Path" }),
    )

    const labelInput = screen.getByDisplayValue("Base Path")
    await user.clear(labelInput)
    await user.type(labelInput, "Media Path")

    expect(store.get(variablesAtom)[0].label).toBe(
      "Media Path",
    )
  })

  test("removes variable from atom when remove button clicked", async () => {
    const user = userEvent.setup()
    const store = renderCard(
      makeVariable({ id: "extraPath" }),
      false,
    )

    await user.click(
      screen.getByTitle(/remove path variable/i),
    )

    expect(store.get(variablesAtom)).toHaveLength(0)
  })

  test("shows path type label in type badge", () => {
    renderCard(makeVariable())
    expect(
      screen.getByText("path variable"),
    ).toBeInTheDocument()
  })
})
