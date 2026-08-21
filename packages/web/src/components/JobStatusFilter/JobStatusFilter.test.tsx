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
import { createStore, Provider } from "jotai"
import type { ReactNode } from "react"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { JOB_STATUSES } from "../../jobs/jobStatuses"
import type { JobStatus } from "../../jobs/types"
import {
  DEFAULT_VISIBLE_JOB_STATUSES,
  visibleJobStatusesAtom,
} from "../../state/visibleJobStatusesAtom"
import { JobStatusFilter } from "./JobStatusFilter"

const STATUS_COUNTS = {
  cancelled: 2,
  completed: 41,
  exited: 3412,
  failed: 3,
  paused: 1,
  pending: 0,
  running: 2,
  skipped: 118,
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const renderFilter = (
  visibleStatuses: readonly JobStatus[] = DEFAULT_VISIBLE_JOB_STATUSES,
) => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(STATUS_COUNTS), {
      headers: { "content-type": "application/json" },
      status: 200,
    }),
  )

  const store = createStore()
  store.set(visibleJobStatusesAtom, visibleStatuses)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const wrapper = ({
    children,
  }: {
    children: ReactNode
  }) => (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>{children}</Provider>
    </QueryClientProvider>
  )

  render(<JobStatusFilter />, { wrapper })

  return store
}

const getChip = (status: string) =>
  screen.getByRole("button", {
    name: new RegExp(`^${status}`),
  })

describe("JobStatusFilter", () => {
  test("renders a chip for every status", () => {
    renderFilter()

    expect(screen.getAllByRole("button")).toHaveLength(
      JOB_STATUSES.length,
    )
  })

  test("exited starts switched off and every other status on", () => {
    renderFilter()

    expect(getChip("exited")).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(getChip("completed")).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  test("switching a status on adds it to the atom", async () => {
    const store = renderFilter()

    await userEvent.click(getChip("exited"))

    expect(store.get(visibleJobStatusesAtom)).toContain(
      "exited",
    )
  })

  test("switching a status off removes it from the atom", async () => {
    const store = renderFilter()

    await userEvent.click(getChip("completed"))

    expect(store.get(visibleJobStatusesAtom)).not.toContain(
      "completed",
    )
  })

  test("shows how many jobs a hidden status is hiding", async () => {
    // The whole reason the count comes off the server: the stream
    // never sent these jobs, so counting the client's own store
    // would render `exited 0` with thousands sitting on disk.
    renderFilter()

    expect(
      await screen.findByRole("button", {
        name: "exited, 3,412 jobs",
      }),
    ).toBeVisible()
  })

  test("a status with no jobs shows a zero rather than no number", async () => {
    renderFilter()

    expect(
      await screen.findByRole("button", {
        name: "pending, 0 jobs",
      }),
    ).toBeVisible()
  })

  test("the group is named for assistive technology", () => {
    renderFilter()

    expect(
      screen.getByRole("group", {
        name: "Filter jobs by status",
      }),
    ).toBeInTheDocument()
  })
})
