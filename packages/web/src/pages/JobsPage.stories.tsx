import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { jobsAtom } from "../state/jobsAtom"
import type { ConnectionStatus } from "../state/jobsConnectionAtom"
import { jobsConnectionAtom } from "../state/jobsConnectionAtom"
import { progressByJobIdAtom } from "../state/progressByJobIdAtom"
import type { Job, ProgressSnapshot } from "../types"
import { JobsPage } from "./JobsPage"

// JobsPage calls useSseStream which opens an EventSource.
// In Storybook there is no real server, so the EventSource quietly fails
// and the status-bar stays in "connecting" or "unstable" — that is fine.
// We pre-seed the store with static job data so the visual states are useful.

const withStore = (
  jobs: Job[],
  status: ConnectionStatus = "connected",
  progress?: Map<string, ProgressSnapshot>,
) => {
  const store = createStore()
  store.set(jobsAtom, new Map(jobs.map((job) => [job.id, job])))
  store.set(jobsConnectionAtom, status)
  if (progress) store.set(progressByJobIdAtom, progress)

  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof JobsPage> = {
  title: "Pages/JobsPage",
  component: JobsPage,
  parameters: { layout: "fullscreen", backgrounds: { default: "dark" } },
}

export default meta
type Story = StoryObj<typeof JobsPage>

export const Empty: Story = {
  decorators: [withStore([])],
}

export const Connecting: Story = {
  decorators: [withStore([], "connecting")],
}

export const Unstable: Story = {
  decorators: [withStore([], "unstable")],
}

export const WithJobs: Story = {
  decorators: [
    withStore(
      [
        {
          id: "j1",
          commandName: "remuxToMkv",
          status: "running",
          startedAt: new Date(Date.now() - 45_000).toISOString(),
          params: { sourcePath: "/media/Dune.mkv" },
        },
        {
          id: "j2",
          commandName: "extractSubtitles",
          status: "completed",
          startedAt: new Date(Date.now() - 120_000).toISOString(),
          completedAt: new Date(Date.now() - 30_000).toISOString(),
        },
        {
          id: "j3",
          commandName: "moveFiles",
          status: "failed",
          error: "ENOENT: /media/old.mkv not found",
        },
      ],
      "connected",
      new Map([
        [
          "j1",
          {
            ratio: 0.6,
            bytesPerSecond: 10_000_000,
            bytesRemaining: 40_000_000,
          },
        ],
      ]),
    ),
  ],
}
