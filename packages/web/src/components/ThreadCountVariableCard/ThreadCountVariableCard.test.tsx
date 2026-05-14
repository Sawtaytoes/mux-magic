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
import { threadCountAtom } from "../../state/threadCountAtom"
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

const renderCard = (initialValue: string | null = null) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(THREADS_RESPONSE),
    }),
  )
  const store = createStore()
  store.set(threadCountAtom, initialValue)
  render(
    <Provider store={store}>
      <ThreadCountVariableCard />
    </Provider>,
  )
  return store
}

describe("ThreadCountVariableCard", () => {
  test('renders "thread count variable" type label', () => {
    renderCard()
    expect(
      screen.getByText(/thread count variable/i),
    ).toBeInTheDocument()
  })

  test("renders a number input", () => {
    renderCard()
    expect(
      screen.getByRole("spinbutton"),
    ).toBeInTheDocument()
  })

  test("shows current numeric value in input", () => {
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

  test("no clear button when value is null", () => {
    renderCard(null)
    expect(
      screen.queryByTitle(/clear thread count/i),
    ).toBeNull()
  })

  test("shows clear button when value is set", () => {
    renderCard("4")
    expect(
      screen.getByTitle(/clear thread count/i),
    ).toBeInTheDocument()
  })

  test("clears atom when clear button clicked", async () => {
    const user = userEvent.setup()
    const store = renderCard("4")
    await user.click(
      screen.getByTitle(/clear thread count/i),
    )
    expect(store.get(threadCountAtom)).toBeNull()
  })

  test("updates atom when input value changes", async () => {
    const user = userEvent.setup()
    const store = renderCard("4")
    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "6")
    expect(store.get(threadCountAtom)).toBe("6")
  })

  test("sets atom to null when input is cleared", async () => {
    const user = userEvent.setup()
    const store = renderCard("4")
    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    expect(store.get(threadCountAtom)).toBeNull()
  })
})
