import {
  cleanup,
  render,
  screen,
  waitFor,
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
import type { PersistedJobError } from "./errorAtoms"
import { errorsAtom, errorsFetchAtom } from "./errorAtoms"
import { ErrorsPanel } from "./ErrorsPanel"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const makeRecord = (
  overrides: Partial<PersistedJobError> = {},
): PersistedJobError => ({
  id: "err_test1",
  jobId: "job_abc",
  level: "error",
  msg: "Something went wrong",
  occurredAt: "2026-05-15T12:00:00.000Z",
  webhookDelivery: {
    attempts: 0,
    state: "pending",
  },
  ...overrides,
})

const renderPanel = (records: PersistedJobError[] = []) => {
  const store = createStore()
  store.set(errorsAtom, records)

  render(
    <Provider store={store}>
      <ErrorsPanel />
    </Provider>,
  )

  return store
}

describe("ErrorsPanel — empty state", () => {
  test("shows empty message when no errors exist", () => {
    renderPanel([])
    expect(screen.getByText(/no errors/i)).toBeVisible()
  })
})

describe("ErrorsPanel — filter inputs build correct query strings", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    )
  })

  test("state filter sends ?state= query param to /api/errors", async () => {
    const store = createStore()

    render(
      <Provider store={store}>
        <ErrorsPanel />
      </Provider>,
    )

    const stateSelect = screen.getByRole("combobox", { name: /state/i })
    await userEvent.selectOptions(stateSelect, "pending")

    await waitFor(() => {
      const mockFetch = vi.mocked(fetch)
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
      expect(lastCall[0]).toContain("state=pending")
    })
  })

  test("jobId filter sends ?jobId= query param to /api/errors", async () => {
    const store = createStore()

    render(
      <Provider store={store}>
        <ErrorsPanel />
      </Provider>,
    )

    const jobIdInput = screen.getByRole("textbox", { name: /job id/i })
    await userEvent.type(jobIdInput, "job_xyz")

    await waitFor(() => {
      const mockFetch = vi.mocked(fetch)
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
      expect(lastCall[0]).toContain("jobId=job_xyz")
    })
  })
})

describe("ErrorsPanel — re-render after redeliver", () => {
  test("panel re-renders after a successful redeliver POST", async () => {
    const pendingRecord = makeRecord({
      id: "err_1",
      webhookDelivery: { attempts: 8, state: "exhausted" },
    })
    const redeliveredRecord: PersistedJobError = {
      ...pendingRecord,
      webhookDelivery: { attempts: 0, state: "pending" },
    }

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        // First call: initial load
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([pendingRecord]),
        })
        // Second call: redeliver POST
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(redeliveredRecord),
        })
        // Third call: reload after redeliver
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([redeliveredRecord]),
        }),
    )

    const store = createStore()

    render(
      <Provider store={store}>
        <ErrorsPanel />
      </Provider>,
    )

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("exhausted")).toBeVisible()
    })

    // Click retry
    await userEvent.click(screen.getByRole("button", { name: /retry delivery/i }))

    // After re-fetch, state should update to pending
    await waitFor(() => {
      expect(screen.getByText("pending")).toBeVisible()
    })
  })
})
