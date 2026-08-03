import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"
import { SchemeMenuButton } from "./SchemeMenuButton"

const STORAGE_KEY = "charcuterie-scheme"

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY)
  document.documentElement.removeAttribute("data-scheme")
})

afterEach(() => {
  cleanup()
  localStorage.removeItem(STORAGE_KEY)
  document.documentElement.removeAttribute("data-scheme")
})

const getSchemeButton = () =>
  screen.getByRole("button", { name: /colour scheme/i })

describe("SchemeMenuButton", () => {
  test("starts on system and reads as a Theme row", () => {
    render(<SchemeMenuButton />)

    const button = getSchemeButton()
    expect(button).toHaveTextContent("Theme: System")
    expect(button).toHaveAccessibleName(/system/i)
  })

  test("cycles light -> dark -> system and drives data-scheme", async () => {
    const user = userEvent.setup()
    render(<SchemeMenuButton />)

    // system -> light: data-scheme is deterministic once a concrete
    // mode is picked, regardless of the OS media query.
    await user.click(getSchemeButton())
    expect(getSchemeButton()).toHaveTextContent(
      "Theme: Light",
    )
    expect(
      document.documentElement.getAttribute("data-scheme"),
    ).toBe("light")
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light")

    // light -> dark
    await user.click(getSchemeButton())
    expect(getSchemeButton()).toHaveTextContent(
      "Theme: Dark",
    )
    expect(
      document.documentElement.getAttribute("data-scheme"),
    ).toBe("dark")
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark")

    // dark -> system (back to the start of the cycle)
    await user.click(getSchemeButton())
    expect(getSchemeButton()).toHaveTextContent(
      "Theme: System",
    )
    expect(localStorage.getItem(STORAGE_KEY)).toBe("system")
  })

  test("restores a persisted mode on mount", () => {
    localStorage.setItem(STORAGE_KEY, "dark")

    render(<SchemeMenuButton />)

    expect(getSchemeButton()).toHaveTextContent(
      "Theme: Dark",
    )
    expect(
      document.documentElement.getAttribute("data-scheme"),
    ).toBe("dark")
  })
})
