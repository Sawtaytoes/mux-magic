import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import { apiRunModalAtom } from "../../components/ApiRunModal/apiRunModalAtom"
import type {
  ActiveChild,
  ApiRunState,
} from "../../components/ApiRunModal/types"
import type { ProgressSnapshot } from "../../jobs/types"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { ApiRunModal } from "./ApiRunModal"

const makeState = (
  jobId: string | null,
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "cancelled",
  logs: string[] = [],
  source: "step" | "sequence" = "sequence",
  activeChildren: ActiveChild[] = [],
): ApiRunState => ({
  jobId,
  status,
  logs,
  activeChildren,
  source,
})

// Generates a deterministic child + progress snapshot for a given index.
const makeChild = (
  index: number,
): { child: ActiveChild; snapshot: ProgressSnapshot } => {
  const jobId = `child-job-${index}`
  const ratio = ((index * 17) % 97) / 100
  const filesTotal = 3 + (index % 8)
  return {
    child: { stepId: `step-${index}`, jobId },
    snapshot: {
      ratio,
      filesDone: Math.floor(ratio * filesTotal),
      filesTotal,
      bytesPerSecond: (2 + index) * 3_000_000,
      bytesRemaining: Math.floor((1 - ratio) * 100_000_000),
    },
  }
}

const makeRunningParams = (count: number) => {
  const pairs = Array.from({ length: count }, (_, idx) =>
    makeChild(idx + 1),
  )
  return {
    initialState: makeState(
      "job-42",
      "running",
      [],
      "sequence",
      pairs.map(({ child }) => child),
    ),
    initialProgress: new Map(
      pairs.map(({ child, snapshot }) => [
        child.jobId as string,
        snapshot,
      ]),
    ),
  }
}

const meta: Meta<typeof ApiRunModal> = {
  title: "Modals/ApiRunModal",
  component: ApiRunModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as ApiRunState
      const initialProgress = context.parameters
        .initialProgress as
        | Map<string, ProgressSnapshot>
        | undefined
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(apiRunModalAtom, initialState)
        if (initialProgress) {
          newStore.set(progressByJobIdAtom, initialProgress)
        }
        return newStore
      })
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      )
    },
  ],
}
export default meta

type Story = StoryObj<typeof ApiRunModal>

export const RunningOneJob: Story = {
  parameters: makeRunningParams(1),
}

export const RunningParallelJobs: Story = {
  parameters: makeRunningParams(2),
}

export const Running10Children: Story = {
  parameters: makeRunningParams(10),
}

export const Completed: Story = {
  parameters: {
    initialState: makeState("job-42", "completed", [
      "[rename] Processing file 1 of 12…",
      "[rename] Processing file 2 of 12…",
      "[rename] Done.",
    ]),
  },
}

export const Failed: Story = {
  parameters: {
    initialState: makeState("job-42", "failed", [
      "[rename] Starting…",
      "[rename] Error: permission denied",
    ]),
  },
}

export const NoJobYet: Story = {
  parameters: { initialState: makeState(null, "pending") },
}
