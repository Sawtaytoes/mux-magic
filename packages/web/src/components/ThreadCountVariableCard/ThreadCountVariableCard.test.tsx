import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
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

// The card now reads /system/threads through @charcuterie/logic/query
// (openapi-fetch + TanStack Query), so each render needs its own
// QueryClient (retries off, cache off for isolation between tests). The
// typed client builds a real `Request`, so the fetch mock returns a real
// `Response` rather than a bare `{ ok, json }` duck.
const withQueryClient = (children: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

const renderCard = (initialValue = "") => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(THREADS_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  )
  const onValueChange = vi.fn<(value: string) => void>()
  render(
    withQueryClient(
      <ThreadCountVariableCard
        variable={makeVariable(initialValue)}
        onValueChange={onValueChange}
      />,
    ),
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

  test("calls /system/threads endpoint on mount", async () => {
    renderCard()
    // The helper text only renders after the query resolves, so its
    // presence proves the request fired and its typed body came back.
    expect(
      await screen.findByText(/max.*8/i),
    ).toBeInTheDocument()
    const mockFetch = vi.mocked(
      window.fetch as ReturnType<typeof vi.fn>,
    )
    const requestArgument = mockFetch.mock.calls[0]?.[0]
    const requestUrl =
      typeof requestArgument === "string"
        ? requestArgument
        : (requestArgument as Request).url
    expect(requestUrl).toContain("/system/threads")
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
