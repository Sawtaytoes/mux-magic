import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import { apiRunModalAtom } from "../../components/ApiRunModal/apiRunModalAtom"
import type {
  ActiveChild,
  ApiRunState,
} from "../../components/ApiRunModal/types"
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

const meta: Meta<typeof ApiRunModal> = {
  title: "Modals/ApiRunModal",
  component: ApiRunModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as ApiRunState
      const initialProgress = context.parameters
        .initialProgress as
        | Map<string, Record<string, unknown>>
        | undefined
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(apiRunModalAtom, initialState)
        if (initialProgress) {
          newStore.set(
            progressByJobIdAtom,
            initialProgress as never,
          )
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

export const Running: Story = {
  parameters: {
    initialState: makeState(
      "job-42",
      "running",
      [],
      "sequence",
      [{ stepId: "step-3", jobId: "child-job-1" }],
    ),
    initialProgress: new Map([
      [
        "child-job-1",
        {
          ratio: 0.42,
          filesDone: 3,
          filesTotal: 7,
          bytesPerSecond: 8_000_000,
          bytesRemaining: 55_000_000,
        },
      ],
    ]),
  },
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
