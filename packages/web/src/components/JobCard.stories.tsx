import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { jobsAtom } from "../state/jobsAtom"
import { progressByJobIdAtom } from "../state/progressByJobIdAtom"
import type { Job } from "../types"
import { JobCard } from "./JobCard"

const withStore = (
  jobs: Job[],
  progress?: Map<string, { ratio?: number; bytesPerSecond?: number; bytesRemaining?: number }>,
) => {
  const store = createStore()
  store.set(jobsAtom, new Map(jobs.map((job) => [job.id, job])))
  if (progress) store.set(progressByJobIdAtom, progress as never)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <div className="max-w-2xl p-4 space-y-4 bg-slate-950 min-h-screen">
        <Story />
      </div>
    </Provider>
  )
}

const meta: Meta<typeof JobCard> = {
  title: "Components/JobCard",
  component: JobCard,
  parameters: { layout: "fullscreen", backgrounds: { default: "dark" } },
}

export default meta
type Story = StoryObj<typeof JobCard>

const pendingJob: Job = {
  id: "job-pending",
  commandName: "copyFiles",
  status: "pending",
  params: { sourcePath: "/media/movies/Inception.mkv", destPath: "/backup/" },
}

const runningJob: Job = {
  id: "job-running",
  commandName: "remuxToMkv",
  status: "running",
  startedAt: new Date(Date.now() - 45_000).toISOString(),
  params: { sourcePath: "/media/movies/Dune.mkv" },
}

const completedJob: Job = {
  id: "job-done",
  commandName: "extractSubtitles",
  status: "completed",
  startedAt: new Date(Date.now() - 120_000).toISOString(),
  completedAt: new Date(Date.now() - 10_000).toISOString(),
  params: { sourcePath: "/media/Dune.mkv" },
  results: [{ file: "/media/Dune.srt", track: 0 }],
}

const failedJob: Job = {
  id: "job-failed",
  commandName: "moveFiles",
  status: "failed",
  error: "ENOENT: no such file or directory, rename '/media/old.mkv'",
}

const sequenceJob: Job = {
  id: "seq-1",
  commandName: "sequence",
  status: "running",
  startedAt: new Date(Date.now() - 90_000).toISOString(),
}

const childA: Job = {
  id: "seq-1-a",
  commandName: "remuxToMkv",
  status: "completed",
  parentJobId: "seq-1",
}

const childB: Job = {
  id: "seq-1-b",
  commandName: "extractSubtitles",
  status: "running",
  parentJobId: "seq-1",
}

export const Pending: Story = {
  args: { job: pendingJob },
  decorators: [withStore([pendingJob])],
}

export const Running: Story = {
  args: { job: runningJob },
  decorators: [
    withStore(
      [runningJob],
      new Map([
        [
          "job-running",
          {
            ratio: 0.42,
            bytesPerSecond: 8_000_000,
            bytesRemaining: 58_000_000,
          },
        ],
      ]),
    ),
  ],
}

export const Completed: Story = {
  args: { job: completedJob },
  decorators: [withStore([completedJob])],
}

export const Failed: Story = {
  args: { job: failedJob },
  decorators: [withStore([failedJob])],
}

export const Sequence: Story = {
  args: { job: sequenceJob },
  decorators: [withStore([sequenceJob, childA, childB])],
}
