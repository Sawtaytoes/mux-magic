import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRef, useState } from "react"
import { afterEach, expect, test, vi } from "vitest"
import type { Variable } from "../../types"
import { PathValueInput } from "./PathValueInput"

const PLACEHOLDER = "/mnt/media or D:\\Media"

// Models VariableCard: the variable value is lifted into state and written
// back through `onValueChange`.
const Harness = () => {
  const [value, setValue] = useState("")

  const valueInputRef = useRef<HTMLInputElement>(null)

  const variable: Variable = {
    id: "pv-1",
    label: "Source",
    type: "path",
    value,
  }

  return (
    <PathValueInput
      onValueChange={setValue}
      valueInputRef={valueInputRef}
      variable={variable}
    />
  )
}

afterEach(() => {
  cleanup()

  vi.unstubAllGlobals()

  vi.restoreAllMocks()
})

test("typing an absolute path opens the directory autocomplete", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          entries: [
            { name: "Movies", isDirectory: true },
            { name: "Music", isDirectory: true },
          ],
          separator: "/",
        }),
    }),
  )

  render(<Harness />)

  const input = screen.getByPlaceholderText(PLACEHOLDER)

  await userEvent.click(input)

  await userEvent.type(input, "/mnt/")

  await waitFor(() => {
    expect(
      screen.getByRole("option", { name: /Movies/ }),
    ).toBeInTheDocument()
  })

  // Focus stayed in the field — this is attached-input mode.
  await waitFor(() => {
    expect(input).toHaveFocus()
  })
})

test("selecting a folder drills in and keeps the list open", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            entries: [
              { name: "Movies", isDirectory: true },
            ],
            separator: "/",
          }),
      })
      .mockResolvedValue({
        json: () =>
          Promise.resolve({
            entries: [
              { name: "Action", isDirectory: true },
            ],
            separator: "/",
          }),
      }),
  )

  render(<Harness />)

  const input = screen.getByPlaceholderText(PLACEHOLDER)

  await userEvent.click(input)

  await userEvent.type(input, "/mnt/")

  await waitFor(() => {
    expect(
      screen.getByRole("option", { name: /Movies/ }),
    ).toBeInTheDocument()
  })

  // Enter accepts the active option ("Movies") — drills, does not close.
  await userEvent.keyboard("{Enter}")

  await waitFor(() => {
    expect(input).toHaveValue("/mnt/Movies/")
  })

  // The next directory was fetched and the popup is still open.
  await waitFor(() => {
    expect(
      screen.getByRole("option", { name: /Action/ }),
    ).toBeInTheDocument()
  })

  expect(screen.getByRole("listbox")).toBeInTheDocument()
})
