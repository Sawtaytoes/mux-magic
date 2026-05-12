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
import type { Job } from "../../jobs/types"
import { jobsAtom } from "../../state/jobsAtom"
import { jobsConnectionAtom } from "../../state/jobsConnectionAtom"
import { JobsPage } from "./JobsPage"

// useSseStream opens an EventSource — stub it out so tests don't need a real server.
vi.mock("../hooks/useSseStream", () => ({
  useSseStream: () => {},
}))

afterEach(cleanup)

const renderPage = (jobs: Job[] = [], connected = true) => {
  const store = createStore()
  store.set(
    jobsAtom,
    new Map(jobs.map((job) => [job.id, job])),
  )
  store.set(
    jobsConnectionAtom,
    connected ? "connected" : "connecting",
  )

  render(
    <Provider store={store}>
      <JobsPage />
    </Provider>,
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
      screen.getByText(/No jobs yet/),
    ).toBeInTheDocument()
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
