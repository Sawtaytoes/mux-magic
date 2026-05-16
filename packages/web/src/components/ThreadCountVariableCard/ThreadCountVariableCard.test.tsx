import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import type { Variable } from "../../types"
import { ThreadCountVariableCard } from "./ThreadCountVariableCard"

const THREADS_RESPONSE = {
  maxThreads: 8,
  defaultThreadCount: 2,
  totalCpus: 8,
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const makeVariable = (
  value: string,
): Variable<"threadCount"> => ({
  id: "tc",
  label: "Max threads (per job)",
  value,
  type: "threadCount",
})

const renderCard = (initialValue = "") => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(THREADS_RESPONSE),
    }),
  )
  const onValueChange = vi.fn<(value: string) => void>()
  render(
    <ThreadCountVariableCard
      variable={makeVariable(initialValue)}
      onValueChange={onValueChange}
    />,
  )
  return onValueChange
}

describe("ThreadCountVariableCard", () => {
  test("renders a number input", () => {
    renderCard()
    expect(
      screen.getByRole("spinbutton"),
    ).toBeInTheDocument()
  })

  test("reflects the variable's value", () => {
    renderCard("4")
    expect(screen.getByRole("spinbutton")).toHaveValue(4)
  })

  test("shows max threads helper text after fetch", async () => {
    renderCard("4")
    expect(
      await screen.findByText(/max.*8/i),
    ).toBeInTheDocument()
  })

  test("calls /system/threads endpoint on mount", () => {
    renderCard()
    const mockFetch = vi.mocked(
      window.fetch as ReturnType<typeof vi.fn>,
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/system/threads"),
    )
  })

  test("calls onValueChange when input value changes", async () => {
    const user = userEvent.setup()
    const onValueChange = renderCard("")
    const input = screen.getByRole("spinbutton")
    await user.type(input, "6")
    expect(onValueChange).toHaveBeenCalledWith("6")
  })

  test("passes empty string when the input is cleared", async () => {
    const user = userEvent.setup()
    const onValueChange = renderCard("4")
    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    expect(onValueChange).toHaveBeenLastCalledWith("")
  })
})
