import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import type { Job, ProgressSnapshot } from "../../jobs/types"
import { jobsAtom } from "../../state/jobsAtom"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { JobCard } from "./JobCard"

const COMMANDS = [
  "remuxToMkv",
  "extractSubtitles",
  "copyFiles",
  "moveFiles",
  "ffmpegTranscode",
] as const

const withStore = (
  jobs: Job[],
  progress?: Map<string, ProgressSnapshot>,
) => {
  const store = createStore()
  store.set(
    jobsAtom,
    new Map(jobs.map((job) => [job.id, job])),
  )
  if (progress) store.set(progressByJobIdAtom, progress)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <div className="max-w-2xl p-4 space-y-4 bg-slate-950 min-h-screen">
        <Story />
      </div>
    </Provider>
  )
}

// Generates a deterministic running child job + progress snapshot.
const makeSequenceChild = (
  index: number,
): { job: Job; snapshot: ProgressSnapshot } => {
  const jobId = `seq-1-child-${index}`
  const ratio = ((index * 17) % 97) / 100
  const filesTotal = 3 + (index % 8)
  return {
    job: {
      id: jobId,
      commandName: COMMANDS[index % COMMANDS.length],
      status: "running",
      parentJobId: "seq-1",
    },
    snapshot: {
      ratio,
      filesDone: Math.floor(ratio * filesTotal),
      filesTotal,
      bytesPerSecond: (2 + index) * 3_000_000,
      bytesRemaining: Math.floor(
        (1 - ratio) * 100_000_000,
      ),
    },
  }
}

const meta: Meta<typeof JobCard> = {
  title: "Components/JobCard",
  component: JobCard,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof JobCard>

const pendingJob: Job = {
  id: "job-pending",
  commandName: "copyFiles",
  status: "pending",
  params: {
    sourcePath: "/media/movies/Inception.mkv",
    destPath: "/backup/",
  },
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
  error:
    "ENOENT: no such file or directory, rename '/media/old.mkv'",
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

export const RunningMultipleTransfers: Story = {
  args: { job: runningJob },
  decorators: [
    withStore(
      [runningJob],
      new Map([
        [
          "job-running",
          {
            ratio: 0.55,
            filesDone: 2,
            filesTotal: 5,
            bytesPerSecond: 12_000_000,
            bytesRemaining: 45_000_000,
            currentFiles: [
              {
                path: "/media/movies/Dune.mkv",
                ratio: 0.8,
              },
              {
                path: "/media/movies/Inception.mkv",
                ratio: 0.3,
              },
            ],
          },
        ],
      ]),
    ),
  ],
}

export const Sequence: Story = {
  args: { job: sequenceJob },
  decorators: [
    withStore(
      [sequenceJob, childA, childB],
      new Map([
        [
          "seq-1-b",
          {
            ratio: 0.35,
            bytesPerSecond: 5_000_000,
            bytesRemaining: 65_000_000,
          },
        ],
      ]),
    ),
  ],
}

const childARunning: Job = {
  ...childA,
  status: "running",
}

export const SequenceParallelSteps: Story = {
  args: { job: sequenceJob },
  decorators: [
    withStore(
      [sequenceJob, childARunning, childB],
      new Map([
        [
          "seq-1-a",
          {
            ratio: 0.78,
            filesDone: 7,
            filesTotal: 9,
            bytesPerSecond: 12_000_000,
            bytesRemaining: 22_000_000,
            currentFiles: [
              {
                path: "/media/movies/Dune.mkv",
                ratio: 0.78,
              },
            ],
          },
        ],
        [
          "seq-1-b",
          {
            ratio: 0.15,
            filesDone: 1,
            filesTotal: 6,
            bytesPerSecond: 5_000_000,
            bytesRemaining: 85_000_000,
          },
        ],
      ]),
    ),
  ],
}

export const Sequence10Children: Story = {
  args: { job: sequenceJob },
  decorators: [
    (() => {
      const pairs = Array.from({ length: 10 }, (_, idx) =>
        makeSequenceChild(idx + 1),
      )
      return withStore(
        [sequenceJob, ...pairs.map(({ job }) => job)],
        new Map(
          pairs.map(({ job, snapshot }) => [
            job.id,
            snapshot,
          ]),
        ),
      )
    })(),
  ],
}
