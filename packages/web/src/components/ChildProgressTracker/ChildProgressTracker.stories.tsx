import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import type { ProgressSnapshot } from "../../jobs/types"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { ChildProgressTracker } from "./ChildProgressTracker"

const STEP_ID = "step-3"
const JOB_ID = "child-job-1"

const withProgress = (snapshot: ProgressSnapshot) =>
  (Story: React.ComponentType) => {
    const [store] = useState(() => {
      const newStore = createStore()
      newStore.set(
        progressByJobIdAtom,
        new Map([[JOB_ID, snapshot]]),
      )
      return newStore
    })
    return (
      <Provider store={store}>
        <div className="bg-slate-800 max-w-2xl">
          <Story />
        </div>
      </Provider>
    )
  }

const meta: Meta<typeof ChildProgressTracker> = {
  title: "Components/ChildProgressTracker",
  component: ChildProgressTracker,
  args: { stepId: STEP_ID, jobId: JOB_ID },
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}
export default meta

type Story = StoryObj<typeof ChildProgressTracker>

export const Indeterminate: Story = {
  decorators: [withProgress({})],
}

export const Determinate: Story = {
  decorators: [
    withProgress({
      ratio: 0.42,
      filesDone: 3,
      filesTotal: 7,
      bytesPerSecond: 8_000_000,
      bytesRemaining: 55_000_000,
    }),
  ],
}

export const WithPerFileRows: Story = {
  decorators: [
    withProgress({
      ratio: 0.6,
      filesDone: 2,
      filesTotal: 4,
      bytesPerSecond: 12_000_000,
      bytesRemaining: 40_000_000,
      currentFiles: [
        { path: "/media/movies/Dune.mkv", ratio: 0.8 },
        {
          path: "/media/movies/Inception.mkv",
          ratio: 0.4,
        },
      ],
    }),
  ],
}

export const Complete: Story = {
  decorators: [
    withProgress({ ratio: 1, filesDone: 7, filesTotal: 7 }),
  ],
}
