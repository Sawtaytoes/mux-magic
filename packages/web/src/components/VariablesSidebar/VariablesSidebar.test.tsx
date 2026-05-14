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

  test("sidebar container has hidden class for small screens", () => {
    renderSidebar()
    const sidebar = screen.getByRole("complementary")
    expect(sidebar.className).toContain("hidden")
  })

  test("sidebar container has lg:flex class for large screens", () => {
    renderSidebar()
    const sidebar = screen.getByRole("complementary")
    expect(sidebar.className).toContain("lg:flex")
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
