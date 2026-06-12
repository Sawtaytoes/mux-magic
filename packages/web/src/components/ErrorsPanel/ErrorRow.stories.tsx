import type { Meta, StoryObj } from "@storybook/react"
import { ErrorRow } from "./ErrorRow"
import type { PersistedJobError } from "./errorAtoms"

const noop = () => Promise.resolve()

const makePendingRecord = (): PersistedJobError => ({
  id: "err_story_pending",
  jobId: "job_abc123",
  level: "error",
  msg: "Webhook delivery pending — first attempt returned HTTP 500",
  occurredAt: new Date(Date.now() - 90_000).toISOString(),
  webhookDelivery: {
    attempts: 1,
    lastAttemptAt: new Date(
      Date.now() - 60_000,
    ).toISOString(),
    lastError: "HTTP 500",
    state: "pending",
  },
})

const makeDeliveredRecord = (): PersistedJobError => ({
  id: "err_story_delivered",
  jobId: "job_def456",
  level: "error",
  msg: "ENOENT: no such file or directory '/media/old.mkv'",
  occurredAt: new Date(Date.now() - 600_000).toISOString(),
  webhookDelivery: {
    attempts: 2,
    lastAttemptAt: new Date(
      Date.now() - 300_000,
    ).toISOString(),
    state: "delivered",
  },
})

const makeExhaustedRecord = (): PersistedJobError => ({
  id: "err_story_exhausted",
  jobId: "job_ghi789",
  errorName: "NetworkError",
  level: "error",
  msg: "Connection refused to webhook endpoint after 8 attempts",
  stack:
    "NetworkError: Connection refused\n  at attemptDelivery (jobErrorDeliveryQueue.ts:57:14)\n  at async runFetchAttempt (jobErrorDeliveryQueue.ts:80:5)\n  at async Timer.<anonymous> (jobErrorDeliveryQueue.ts:152:5)",
  traceId: "trace_0abc1def2345",
  spanId: "span_6789abcd",
  stepIndex: 1,
  fileId: "/media/Shrek.2001.mkv",
  occurredAt: new Date(
    Date.now() - 7_200_000,
  ).toISOString(),
  webhookDelivery: {
    attempts: 8,
    lastAttemptAt: new Date(
      Date.now() - 3_600_000,
    ).toISOString(),
    lastError: "HTTP 503",
    state: "exhausted",
  },
})

const meta: Meta<typeof ErrorRow> = {
  title: "Components/ErrorRow",
  component: ErrorRow,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  args: {
    onDismiss: noop,
    onRedeliver: noop,
  },
}

export default meta
type Story = StoryObj<typeof ErrorRow>

export const Pending: Story = {
  args: { record: makePendingRecord() },
}

export const Delivered: Story = {
  args: { record: makeDeliveredRecord() },
}

export const Exhausted: Story = {
  args: { record: makeExhaustedRecord() },
}
