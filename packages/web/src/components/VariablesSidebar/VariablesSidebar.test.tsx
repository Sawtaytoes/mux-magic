import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { variablesAtom } from "../../state/variablesAtom"
import { VariablesSidebar } from "./VariablesSidebar"

const renderSidebar = () => {
  const store = createStore()
  store.set(variablesAtom, [])
  render(
    <Provider store={store}>
      <VariablesSidebar />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

describe("VariablesSidebar", () => {
  test("renders the sidebar container", () => {
    renderSidebar()
    expect(
      screen.getByRole("complementary"),
    ).toBeInTheDocument()
  })

  test("sidebar stays in the DOM at narrow widths (relocates, not hidden)", () => {
    renderSidebar()
    const sidebar = screen.getByRole("complementary")
    // Adopted onto the @charcuterie/ui Rail: below md it relocates to a
    // scrolling strip instead of `display:none`, so it is never removed.
    expect(sidebar.className).not.toContain("hidden")
  })

  test("sidebar becomes a fixed-width column at md and up", () => {
    renderSidebar()
    const sidebar = screen.getByRole("complementary")
    expect(sidebar.className).toContain("md:w-64")
  })

  test("sidebar has a Variables heading", () => {
    renderSidebar()
    expect(
      screen.getByRole("heading", { name: /variables/i }),
    ).toBeInTheDocument()
  })

  test("sidebar shows VariablesPanel body", () => {
    renderSidebar()
    expect(
      screen.getByRole("button", { name: /add variable/i }),
    ).toBeInTheDocument()
  })
})
