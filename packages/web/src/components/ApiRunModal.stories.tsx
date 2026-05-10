import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import { apiRunModalAtom } from "../state/uiAtoms"
import type { ApiRunState } from "../types"
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
): ApiRunState => ({
  jobId,
  status,
  logs,
  childJobId: null,
  childStepId: null,
})

const meta: Meta<typeof ApiRunModal> = {
  title: "Components/ApiRunModal",
  component: ApiRunModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as ApiRunState
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(apiRunModalAtom, initialState)
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
    initialState: makeState("job-42", "running"),
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
