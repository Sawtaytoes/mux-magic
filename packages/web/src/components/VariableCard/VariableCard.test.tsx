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

  test("renders a dvdCompareId value input when type is dvdCompareId", () => {
    const variable: Variable = {
      id: "dvdCompareIdVariable_abc",
      label: "Spider-Man 2002",
      value: "spider-man-2002",
      type: "dvdCompareId",
    }
    renderCard(variable)
    expect(
      screen.getByDisplayValue("spider-man-2002"),
    ).toBeVisible()
    expect(
      screen.getByText("dvdCompareId variable"),
    ).toBeVisible()
  })

  test("the dvdCompareId input reflects the variable's atom value", () => {
    // Data binding (atom → input) only. Typing into a Jotai-backed
    // controlled input via user-event races vitest-browser's keystroke
    // timing; the end-to-end user flow (type → atom update → YAML round-
    // trip) is covered in e2e/variables-modal.spec.ts under "dvdCompareId
    // variable survives YAML copy-reload". See AGENTS.md "Test interaction
    // conventions" for the documented constraint.
    const variable: Variable = {
      id: "dvdCompareIdVariable_abc",
      label: "Spider-Man 2002",
      value: "74759",
      type: "dvdCompareId",
    }
    renderCard(variable)
    const valueInput = screen.getByPlaceholderText(
      /spider-man-2002 or/i,
    )
    expect(valueInput).toHaveValue("74759")
  })

  test("does not show the folder browse button for dvdCompareId variables", () => {
    const variable: Variable = {
      id: "dvdCompareIdVariable_abc",
      label: "Spider-Man 2002",
      value: "",
      type: "dvdCompareId",
    }
    renderCard(variable)
    expect(
      screen.queryByTitle(/browse|pick a folder/i),
    ).toBeNull()
  })
})
