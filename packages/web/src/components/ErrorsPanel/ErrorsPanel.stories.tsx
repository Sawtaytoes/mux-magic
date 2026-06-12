import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { ErrorsPanel } from "./ErrorsPanel"
import type { PersistedJobError } from "./errorAtoms"
import { errorsAtom } from "./errorAtoms"

const withStore = (records: PersistedJobError[]) => {
  const store = createStore()
  store.set(errorsAtom, records)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <div className="max-w-3xl p-4 space-y-4 bg-slate-950 min-h-screen">
        <Story />
      </div>
    </Provider>
  )
}

const makePendingRecord = (
  overrides: Partial<PersistedJobError> = {},
): PersistedJobError => ({
  id: "err_pending1",
  jobId: "job_abc123",
  level: "error",
  msg: "Webhook POST failed with HTTP 500",
  occurredAt: new Date(Date.now() - 120_000).toISOString(),
  webhookDelivery: {
    attempts: 1,
    lastAttemptAt: new Date(
      Date.now() - 60_000,
    ).toISOString(),
    state: "pending",
  },
  ...overrides,
})

const makeDeliveredRecord = (
  overrides: Partial<PersistedJobError> = {},
): PersistedJobError => ({
  id: "err_delivered1",
  jobId: "job_def456",
  level: "error",
  msg: "Job failed: ENOENT no such file",
  occurredAt: new Date(Date.now() - 600_000).toISOString(),
  webhookDelivery: {
    attempts: 2,
    lastAttemptAt: new Date(
      Date.now() - 300_000,
    ).toISOString(),
    state: "delivered",
  },
  ...overrides,
})

const makeExhaustedRecord = (
  overrides: Partial<PersistedJobError> = {},
): PersistedJobError => ({
  id: "err_exhausted1",
  jobId: "job_ghi789",
  level: "error",
  errorName: "NetworkError",
  msg: "Connection refused to webhook endpoint",
  stack:
    "NetworkError: Connection refused\n  at attemptDelivery (queue.ts:45:12)\n  at async run (queue.ts:88:5)",
  traceId: "trace_abc123",
  spanId: "span_def456",
  occurredAt: new Date(
    Date.now() - 3_600_000,
  ).toISOString(),
  webhookDelivery: {
    attempts: 8,
    lastAttemptAt: new Date(
      Date.now() - 1_800_000,
    ).toISOString(),
    lastError: "HTTP 503",
    state: "exhausted",
  },
  ...overrides,
})

const meta: Meta<typeof ErrorsPanel> = {
  title: "Components/ErrorsPanel",
  component: ErrorsPanel,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof ErrorsPanel>

export const Empty: Story = {
  decorators: [withStore([])],
}

export const WithPending: Story = {
  decorators: [withStore([makePendingRecord()])],
}

export const WithDelivered: Story = {
  decorators: [withStore([makeDeliveredRecord()])],
}

export const WithExhausted: Story = {
  decorators: [withStore([makeExhaustedRecord()])],
}

export const Mixed: Story = {
  decorators: [
    withStore([
      makePendingRecord({
        id: "err_m1",
        jobId: "job_aaa",
        msg: "First pending error",
        occurredAt: new Date(
          Date.now() - 30_000,
        ).toISOString(),
      }),
      makeExhaustedRecord({
        id: "err_m2",
        jobId: "job_bbb",
        msg: "Exhausted after max retries",
        occurredAt: new Date(
          Date.now() - 180_000,
        ).toISOString(),
      }),
      makeDeliveredRecord({
        id: "err_m3",
        jobId: "job_ccc",
        msg: "Successfully delivered after retry",
        occurredAt: new Date(
          Date.now() - 900_000,
        ).toISOString(),
      }),
      makePendingRecord({
        id: "err_m4",
        jobId: "job_ddd",
        msg: "Another pending: ffmpeg failed with code 1",
        occurredAt: new Date(
          Date.now() - 1_200_000,
        ).toISOString(),
        stepIndex: 2,
        fileId: "/media/movies/Inception.mkv",
      }),
      makeExhaustedRecord({
        id: "err_m5",
        jobId: "job_eee",
        msg: "Disk quota exceeded",
        occurredAt: new Date(
          Date.now() - 7_200_000,
        ).toISOString(),
        webhookDelivery: {
          attempts: 8,
          lastAttemptAt: new Date(
            Date.now() - 3_600_000,
          ).toISOString(),
          lastError: "HTTP 404",
          state: "exhausted",
        },
      }),
    ]),
  ],
}
