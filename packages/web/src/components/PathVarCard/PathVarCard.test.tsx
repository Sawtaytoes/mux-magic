import {
  cleanup,
  fireEvent,
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
import { pathsAtom } from "../../state/pathsAtom"
import type { PathVar } from "../../types"
import { PathVarCard } from "./PathVarCard"

const makePath = (
  overrides: Partial<PathVar> = {},
): PathVar => ({
  id: "basePath",
  label: "Base Path",
  value: "/mnt/media",
  ...overrides,
})

const renderCard = (pathVar: PathVar, isFirst = true) => {
  const store = createStore()
  store.set(pathsAtom, [pathVar])
  render(
    <Provider store={store}>
      <PathVarCard pathVar={pathVar} isFirst={isFirst} />
    </Provider>,
  )
  return store
}

beforeEach(() => {
  window.mediaTools = {}
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("PathVarCard", () => {
  test("renders the label input with current value", () => {
    renderCard(makePath({ label: "Base Path" }))
    expect(
      screen.getByDisplayValue("Base Path"),
    ).toBeInTheDocument()
  })

  test("renders the value input with current path", () => {
    renderCard(makePath({ value: "/mnt/media" }))
    expect(
      screen.getByDisplayValue("/mnt/media"),
    ).toBeInTheDocument()
  })

  test("does not show remove button for first path var", () => {
    renderCard(makePath(), true)
    expect(
      screen.queryByTitle(/remove path variable/i),
    ).toBeNull()
  })

  test("shows remove button for non-first path var", () => {
    renderCard(makePath({ id: "extraPath" }), false)
    expect(
      screen.getByTitle(/remove path variable/i),
    ).toBeInTheDocument()
  })

  test("updates label in atom on change", () => {
    const store = renderCard(
      makePath({ label: "Base Path" }),
    )

    const labelInput = screen.getByDisplayValue("Base Path")
    fireEvent.change(labelInput, {
      target: { value: "Media Path" },
    })

    expect(store.get(pathsAtom)[0].label).toBe("Media Path")
  })

  test("removes path from atom when remove button clicked", async () => {
    const user = userEvent.setup()
    const store = renderCard(
      makePath({ id: "extraPath" }),
      false,
    )

    await user.click(
      screen.getByTitle(/remove path variable/i),
    )

    expect(store.get(pathsAtom)).toHaveLength(0)
  })
})
