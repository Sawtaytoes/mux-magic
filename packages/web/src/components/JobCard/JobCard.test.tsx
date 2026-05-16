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
import { apiBase } from "../../apiBase"
import { makeFakeJob } from "../../jobs/__fixtures__/makeFakeJob"
import type { Job } from "../../jobs/types"
import { jobsAtom } from "../../state/jobsAtom"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { JobCard } from "./JobCard"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const pendingJob = makeFakeJob({
  id: "job-1",
  commandName: "copyFiles",
  status: "pending",
})

const runningJob = makeFakeJob({
  id: "job-2",
  commandName: "remuxToMkv",
  status: "running",
  startedAt: new Date("2026-01-01T10:00:00Z").toISOString(),
})

const completedJob = makeFakeJob({
  id: "job-3",
  commandName: "extractSubtitles",
  status: "completed",
  startedAt: new Date("2026-01-01T10:00:00Z").toISOString(),
  completedAt: new Date(
    "2026-01-01T10:01:00Z",
  ).toISOString(),
  results: [{ file: "/out.srt" }],
})

const failedJob = makeFakeJob({
  id: "job-4",
  commandName: "moveFiles",
  status: "failed",
  error: "File not found",
})

const renderCard = (job: Job, extraJobs: Job[] = []) => {
  const store = createStore()
  const allJobs = new Map([
    [job.id, job],
    ...extraJobs.map((child) => [child.id, child] as const),
  ])
  store.set(jobsAtom, allJobs)

  render(
    <Provider store={store}>
      <JobCard job={job} />
    </Provider>,
  )

  return store
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("JobCard rendering", () => {
  test("shows the human-readable command label", () => {
    renderCard(pendingJob)
    expect(
      screen.getByText("Copy Files"),
    ).toBeInTheDocument()
  })

  test("falls back to the raw command name for unknown commands", () => {
    renderCard(
      makeFakeJob({
        id: "x",
        commandName: "unknownThing",
        status: "pending",
      }),
    )
    expect(
      screen.getByText("unknownThing"),
    ).toBeInTheDocument()
  })

  test("shows the job ID", () => {
    renderCard(pendingJob)
    expect(
      screen.getByText(/ID: job-1/),
    ).toBeInTheDocument()
  })

  test("shows status badge", () => {
    renderCard(runningJob)
    expect(screen.getByText("running")).toBeInTheDocument()
  })

  test("shows started-at when present", () => {
    renderCard(runningJob)
    expect(screen.getByText(/Started:/)).toBeInTheDocument()
  })

  test("shows completed-at for completed jobs", () => {
    renderCard(completedJob)
    expect(
      screen.getByText(/Completed:/),
    ).toBeInTheDocument()
  })

  test("shows error message for failed jobs", () => {
    renderCard(failedJob)
    expect(
      screen.getByText("File not found"),
    ).toBeInTheDocument()
  })

  test("shows results count when results are present", () => {
    renderCard(completedJob)
    expect(
      screen.getByText(/Results \(1\)/),
    ).toBeInTheDocument()
  })
})

// ─── Progress bar ─────────────────────────────────────────────────────────────

describe("JobCard progress bar", () => {
  test("shows progress bar for running jobs that have a snapshot", () => {
    const store = createStore()
    store.set(
      jobsAtom,
      new Map([[runningJob.id, runningJob]]),
    )
    store.set(
      progressByJobIdAtom,
      new Map([[runningJob.id, { ratio: 0.5 }]]),
    )

    render(
      <Provider store={store}>
        <JobCard job={runningJob} />
      </Provider>,
    )

    expect(
      screen.getByRole("progressbar"),
    ).toBeInTheDocument()
  })

  test("hides progress bar for running jobs with no snapshot yet", () => {
    renderCard(runningJob)
    expect(screen.queryByRole("progressbar")).toBeNull()
  })

  test("hides progress bar for completed jobs", () => {
    renderCard(completedJob)
    expect(screen.queryByRole("progressbar")).toBeNull()
  })
})

// ─── Params ───────────────────────────────────────────────────────────────────

describe("JobCard params", () => {
  test("shows params disclosure when job has params", () => {
    renderCard({
      ...pendingJob,
      params: { sourcePath: "/movies/Inception.mkv" },
    })
    expect(screen.getByText("Params")).toBeInTheDocument()
  })

  test("hides params disclosure when job has no params", () => {
    renderCard(pendingJob)
    expect(screen.queryByText("Params")).toBeNull()
  })
})

// ─── Cancel button ────────────────────────────────────────────────────────────

describe("JobCard cancel button", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true }),
    )
  })

  test("shows cancel button only for running jobs", () => {
    renderCard(runningJob)
    expect(
      screen.getAllByRole("button", { name: /cancel/i }),
    ).not.toHaveLength(0)
  })

  test("does not show cancel button for completed jobs", () => {
    renderCard(completedJob)
    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).toBeNull()
  })

  test("calls DELETE /jobs/:id on cancel click", async () => {
    const user = userEvent.setup()
    renderCard(runningJob)

    const cancelButtons = screen.getAllByRole("button", {
      name: /cancel/i,
    })
    await user.click(cancelButtons[0])

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${apiBase}/jobs/job-2`,
      {
        method: "DELETE",
      },
    )
  })
})

// ─── Children / steps ────────────────────────────────────────────────────────

describe("JobCard steps disclosure", () => {
  const parentJob = makeFakeJob({
    id: "parent",
    commandName: "sequence",
    status: "running",
  })

  const childJob = makeFakeJob({
    id: "child-1",
    commandName: "copyFiles",
    status: "running",
    parentJobId: "parent",
  })

  test("shows steps section when children are present", () => {
    renderCard(parentJob, [childJob])
    expect(
      screen.getByText(/Steps \(1\)/),
    ).toBeInTheDocument()
  })

  test("hides steps section when job has no children", () => {
    renderCard(runningJob)
    expect(screen.queryByText(/Steps/)).toBeNull()
  })
})
