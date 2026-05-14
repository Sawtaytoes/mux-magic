import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useState } from "react"
import type { ProgressSnapshot } from "../../jobs/types"
import { progressByJobIdAtom } from "../../state/progressByJobIdAtom"
import { SequenceRunModal } from "./SequenceRunModal"
import { sequenceRunModalAtom } from "./sequenceRunModalAtom"
import type {
  ActiveChild,
  SequenceRunModalState,
} from "./types"

const ReOpenButton = ({
  initialState,
}: {
  initialState: SequenceRunModalState
}) => {
  const setSequenceRun = useSetAtom(sequenceRunModalAtom)
  return (
    <div className="p-4">
      <button
        type="button"
        className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded"
        onClick={() => setSequenceRun(initialState)}
      >
        Re-open modal
      </button>
    </div>
  )
}

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
): SequenceRunModalState => ({
  mode: "open",
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

const meta: Meta<typeof SequenceRunModal> = {
  title: "Modals/SequenceRunModal",
  component: SequenceRunModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as SequenceRunModalState
      const initialProgress = context.parameters
        .initialProgress as
        | Map<string, ProgressSnapshot>
        | undefined
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(sequenceRunModalAtom, initialState)
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

type Story = StoryObj<typeof SequenceRunModal>

const runningOneJobParams = makeRunningParams(1)
const runningParallelJobsParams = makeRunningParams(2)
const running10ChildrenParams = makeRunningParams(10)
const completedState = makeState("job-42", "completed", [
  "[rename] Processing file 1 of 12…",
  "[rename] Processing file 2 of 12…",
  "[rename] Done.",
])
const failedState = makeState("job-42", "failed", [
  "[rename] Starting…",
  "[rename] Error: permission denied",
])
const noJobYetState = makeState(null, "pending")

export const RunningOneJob: Story = {
  parameters: runningOneJobParams,
  render: () => (
    <>
      <ReOpenButton
        initialState={runningOneJobParams.initialState}
      />
      <SequenceRunModal />
    </>
  ),
}

export const RunningParallelJobs: Story = {
  parameters: runningParallelJobsParams,
  render: () => (
    <>
      <ReOpenButton
        initialState={
          runningParallelJobsParams.initialState
        }
      />
      <SequenceRunModal />
    </>
  ),
}

export const Running10Children: Story = {
  parameters: running10ChildrenParams,
  render: () => (
    <>
      <ReOpenButton
        initialState={running10ChildrenParams.initialState}
      />
      <SequenceRunModal />
    </>
  ),
}

export const Completed: Story = {
  parameters: { initialState: completedState },
  render: () => (
    <>
      <ReOpenButton initialState={completedState} />
      <SequenceRunModal />
    </>
  ),
}

export const Failed: Story = {
  parameters: { initialState: failedState },
  render: () => (
    <>
      <ReOpenButton initialState={failedState} />
      <SequenceRunModal />
    </>
  ),
}

export const NoJobYet: Story = {
  parameters: { initialState: noJobYetState },
  render: () => (
    <>
      <ReOpenButton initialState={noJobYetState} />
      <SequenceRunModal />
    </>
  ),
}
