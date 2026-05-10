import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { HttpResponse, http } from "msw"
import { apiRunModalAtom } from "../state/uiAtoms"
import { ApiRunModal } from "./ApiRunModal"

const logStreamHandler = http.get("/jobs/:jobId/logs", () => {
  const stream = new ReadableStream({ start() {} })
  return new HttpResponse(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  })
})

const makeStore = (
  jobId: string | null,
  status: "pending" | "running" | "completed" | "failed" | "cancelled",
  logs: string[] = [],
) => {
  const store = createStore()
  store.set(apiRunModalAtom, {
    jobId,
    status,
    logs,
    childJobId: null,
    childStepId: null,
  })
  return store
}

const meta: Meta<typeof ApiRunModal> = {
  title: "Wave E/ApiRunModal",
  component: ApiRunModal,
  parameters: {
    msw: { handlers: [logStreamHandler] },
  },
  decorators: [
    (Story, context) => {
      const store = context.parameters["store"] as ReturnType<typeof createStore>
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
  parameters: { store: makeStore("job-42", "running") },
}

export const Completed: Story = {
  parameters: {
    store: makeStore("job-42", "completed", [
      "[rename] Processing file 1 of 12…",
      "[rename] Processing file 2 of 12…",
      "[rename] Done.",
    ]),
  },
}

export const Failed: Story = {
  parameters: {
    store: makeStore("job-42", "failed", [
      "[rename] Starting…",
      "[rename] Error: permission denied",
    ]),
  },
}

export const NoJobYet: Story = {
  parameters: { store: makeStore(null, "pending") },
}
