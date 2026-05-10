import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { jobsAtom } from "../state/jobsAtom"
import { progressByJobIdAtom } from "../state/progressByJobIdAtom"
import type { Job } from "../types"
import { JobCard } from "./JobCard"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const pendingJob: Job = {
  id: "job-1",
  commandName: "copyFiles",
  status: "pending",
}

const runningJob: Job = {
  id: "job-2",
  commandName: "remuxToMkv",
  status: "running",
  startedAt: new Date("2026-01-01T10:00:00Z").toISOString(),
}

const completedJob: Job = {
  id: "job-3",
  commandName: "extractSubtitles",
  status: "completed",
  startedAt: new Date("2026-01-01T10:00:00Z").toISOString(),
  completedAt: new Date("2026-01-01T10:01:00Z").toISOString(),
  results: [{ file: "/out.srt" }],
}

const failedJob: Job = {
  id: "job-4",
  commandName: "moveFiles",
  status: "failed",
  error: "File not found",
}

const renderCard = (job: Job, extraJobs: Job[] = []) => {
  const store = createStore()
  const allJobs = new Map([[job.id, job], ...extraJobs.map((child) => [child.id, child] as const)])
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
  it("shows the human-readable command label", () => {
    renderCard(pendingJob)
    expect(screen.getByText("Copy Files")).toBeInTheDocument()
  })

  it("falls back to the raw command name for unknown commands", () => {
    renderCard({ id: "x", commandName: "unknownThing", status: "pending" })
    expect(screen.getByText("unknownThing")).toBeInTheDocument()
  })

  it("shows the job ID", () => {
    renderCard(pendingJob)
    expect(screen.getByText(/ID: job-1/)).toBeInTheDocument()
  })

  it("shows status badge", () => {
    renderCard(runningJob)
    expect(screen.getByText("running")).toBeInTheDocument()
  })

  it("shows started-at when present", () => {
    renderCard(runningJob)
    expect(screen.getByText(/Started:/)).toBeInTheDocument()
  })

  it("shows completed-at for completed jobs", () => {
    renderCard(completedJob)
    expect(screen.getByText(/Completed:/)).toBeInTheDocument()
  })

  it("shows error message for failed jobs", () => {
    renderCard(failedJob)
    expect(screen.getByText("File not found")).toBeInTheDocument()
  })

  it("shows results count when results are present", () => {
    renderCard(completedJob)
    expect(screen.getByText(/Results \(1\)/)).toBeInTheDocument()
  })
})

// ─── Progress bar ─────────────────────────────────────────────────────────────

describe("JobCard progress bar", () => {
  it("shows progress bar for running jobs that have a snapshot", () => {
    const store = createStore()
    store.set(jobsAtom, new Map([[runningJob.id, runningJob]]))
    store.set(progressByJobIdAtom, new Map([[runningJob.id, { ratio: 0.5 }]]))

    render(
      <Provider store={store}>
        <JobCard job={runningJob} />
      </Provider>,
    )

    expect(screen.getByTestId("progress-bar")).toBeInTheDocument()
  })

  it("hides progress bar for running jobs with no snapshot yet", () => {
    renderCard(runningJob)
    expect(screen.queryByTestId("progress-bar")).toBeNull()
  })

  it("hides progress bar for completed jobs", () => {
    renderCard(completedJob)
    expect(screen.queryByTestId("progress-bar")).toBeNull()
  })
})

// ─── Params ───────────────────────────────────────────────────────────────────

describe("JobCard params", () => {
  it("shows params disclosure when job has params", () => {
    renderCard({
      ...pendingJob,
      params: { sourcePath: "/movies/Inception.mkv" },
    })
    expect(screen.getByText("Params")).toBeInTheDocument()
  })

  it("hides params disclosure when job has no params", () => {
    renderCard(pendingJob)
    expect(screen.queryByText("Params")).toBeNull()
  })
})

// ─── Cancel button ────────────────────────────────────────────────────────────

describe("JobCard cancel button", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
  })

  it("shows cancel button only for running jobs", () => {
    renderCard(runningJob)
    expect(screen.getAllByRole("button", { name: /cancel/i })).not.toHaveLength(0)
  })

  it("does not show cancel button for completed jobs", () => {
    renderCard(completedJob)
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull()
  })

  it("calls DELETE /jobs/:id on cancel click", async () => {
    const user = userEvent.setup()
    renderCard(runningJob)

    const cancelButtons = screen.getAllByRole("button", { name: /cancel/i })
    await user.click(cancelButtons[0])

    expect(globalThis.fetch).toHaveBeenCalledWith("/jobs/job-2", {
      method: "DELETE",
    })
  })
})

// ─── Children / steps ────────────────────────────────────────────────────────

describe("JobCard steps disclosure", () => {
  const parentJob: Job = {
    id: "parent",
    commandName: "sequence",
    status: "running",
  }

  const childJob: Job = {
    id: "child-1",
    commandName: "copyFiles",
    status: "running",
    parentJobId: "parent",
  }

  it("shows steps section when children are present", () => {
    renderCard(parentJob, [childJob])
    expect(screen.getByText(/Steps \(1\)/)).toBeInTheDocument()
  })

  it("hides steps section when job has no children", () => {
    renderCard(runningJob)
    expect(screen.queryByText(/Steps/)).toBeNull()
  })
})
