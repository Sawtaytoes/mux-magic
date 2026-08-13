import {
  cleanup,
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
import { variablesAtom } from "../../state/variablesAtom"
import { VariablesSidebar } from "./VariablesSidebar"

const stubViewport = (isWide: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: isWide,
      media: "(min-width: 48rem)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }),
  })
}

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

beforeEach(() => {
  // Default to the narrow layout; the resize behaviour is `md`+ only.
  stubViewport(false)
  window.localStorage.clear()
})

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

  test("no resize separator at narrow widths", () => {
    renderSidebar()
    expect(screen.queryByRole("separator")).toBeNull()
  })

  test("renders a draggable resize separator at md and up", () => {
    stubViewport(true)
    renderSidebar()
    const separator = screen.getByRole("separator", {
      name: /resize variables sidebar/i,
    })
    expect(separator).toHaveAttribute(
      "aria-orientation",
      "vertical",
    )
  })

  test("arrow keys resize the rail and persist the width", async () => {
    stubViewport(true)
    const user = userEvent.setup()
    renderSidebar()
    const separator = screen.getByRole("separator", {
      name: /resize variables sidebar/i,
    })
    const widthBefore = Number(
      separator.getAttribute("aria-valuenow"),
    )
    separator.focus()
    await user.keyboard("{ArrowLeft}")
    const widthAfter = Number(
      separator.getAttribute("aria-valuenow"),
    )
    expect(widthAfter).toBe(widthBefore + 16)
    expect(
      window.localStorage.getItem(
        "mux-magic:variables-rail-width",
      ),
    ).toBe(String(widthAfter))
  })
})
