import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { makeFakeJob } from "../../jobs/__fixtures__/makeFakeJob"
import type { Job, JobStatus } from "../../jobs/types"
import { jobsAtom } from "../../state/jobsAtom"
import { jobsConnectionAtom } from "../../state/jobsConnectionAtom"
import {
  DEFAULT_VISIBLE_JOB_STATUSES,
  visibleJobStatusesAtom,
} from "../../state/visibleJobStatusesAtom"
import { JobsPage } from "./JobsPage"

// useSseStream opens an EventSource — stub it out so tests don't need a real server.
vi.mock("../hooks/useSseStream", () => ({
  useSseStream: () => {},
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const renderPage = (
  jobs: Job[] = [],
  isConnected = true,
  visibleStatuses: readonly JobStatus[] = DEFAULT_VISIBLE_JOB_STATUSES,
) => {
  const store = createStore()
  store.set(
    jobsAtom,
    new Map(jobs.map((job) => [job.id, job])),
  )
  store.set(
    jobsConnectionAtom,
    isConnected ? "connected" : "connecting",
  )
  store.set(visibleJobStatusesAtom, visibleStatuses)

  // The status filter counts chips off /jobs/status-counts. The
  // page renders fine before it resolves — the chips just carry no
  // number — so the query is left to fail rather than stubbed.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <JobsPage />
      </Provider>
    </QueryClientProvider>,
  )

  return store
}

describe("JobsPage", () => {
  test("renders page heading", () => {
    renderPage()
    expect(
      screen.getByRole("heading", { name: /jobs/i }),
    ).toBeInTheDocument()
  })

  test("shows empty state when no jobs exist", () => {
    renderPage()
    expect(
      screen.getByRole("heading", {
        name: "Nothing to show",
      }),
    ).toBeInTheDocument()
  })

  test("hides exited jobs by default", () => {
    renderPage([
      makeFakeJob({
        id: "j1",
        commandName: "copyFiles",
        status: "completed",
      }),
      makeFakeJob({
        id: "j2",
        commandName: "exitIfEmpty",
        status: "exited",
      }),
    ])

    expect(screen.getAllByRole("article")).toHaveLength(1)
  })

  test("shows exited jobs once the status is switched on", () => {
    renderPage(
      [
        makeFakeJob({
          id: "j1",
          commandName: "copyFiles",
          status: "completed",
        }),
        makeFakeJob({
          id: "j2",
          commandName: "exitIfEmpty",
          status: "exited",
        }),
      ],
      true,
      DEFAULT_VISIBLE_JOB_STATUSES.concat("exited"),
    )

    expect(screen.getAllByRole("article")).toHaveLength(2)
  })

  test("keeps the exited chip switched off by default", () => {
    renderPage()

    expect(
      screen.getByRole("button", { name: /^exited/ }),
    ).toHaveAttribute("aria-pressed", "false")
  })

  test("renders a card for each top-level job", () => {
    renderPage([
      makeFakeJob({
        id: "j1",
        commandName: "copyFiles",
        status: "completed",
      }),
      makeFakeJob({
        id: "j2",
        commandName: "remuxToMkv",
        status: "running",
      }),
    ])
    expect(screen.getAllByRole("article")).toHaveLength(2)
  })

  test("does not render child jobs as top-level cards", () => {
    renderPage([
      makeFakeJob({
        id: "parent",
        commandName: "sequence",
        status: "running",
      }),
      makeFakeJob({
        id: "child",
        commandName: "copyFiles",
        status: "running",
        parentJobId: "parent",
      }),
    ])
    expect(screen.getAllByRole("article")).toHaveLength(1)
  })

  test("shows the StatusBar", () => {
    renderPage()
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  test("shows Connected status when connected", () => {
    renderPage([], true)
    expect(
      screen.getByText("Connected"),
    ).toBeInTheDocument()
  })
})
