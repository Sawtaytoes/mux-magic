import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"

import { JOB_STATUSES } from "../../jobs/jobStatuses"
import type { JobStatus } from "../../jobs/types"
import {
  DEFAULT_VISIBLE_JOB_STATUSES,
  visibleJobStatusesAtom,
} from "../../state/visibleJobStatusesAtom"
import { JobStatusFilter } from "./JobStatusFilter"

// Counts come from the Storybook mock server's /jobs/status-counts
// route, not from the store — see the component's note on why the
// number cannot be counted client-side.
const withVisibleStatuses =
  (visibleStatuses: readonly JobStatus[]) =>
  (Story: React.ComponentType) => {
    const store = createStore()
    store.set(visibleJobStatusesAtom, visibleStatuses)

    return (
      <Provider store={store}>
        <div className="bg-surface-base p-4">
          <Story />
        </div>
      </Provider>
    )
  }

const meta: Meta<typeof JobStatusFilter> = {
  title: "Components/JobStatusFilter",
  component: JobStatusFilter,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof JobStatusFilter>

/** How the Jobs page opens: everything on except `exited`. */
export const Default: Story = {
  decorators: [
    withVisibleStatuses(DEFAULT_VISIBLE_JOB_STATUSES),
  ],
}

/** After switching `exited` back on — every chip pressed. */
export const AllStatusesShowing: Story = {
  decorators: [withVisibleStatuses(JOB_STATUSES)],
}

/** Narrowed to what went wrong, which is the other common shape. */
export const OnlyFailures: Story = {
  decorators: [
    withVisibleStatuses(["failed", "cancelled"]),
  ],
}

/**
 * Every status switched off. Legal, reachable by clicking, and the
 * reason the jobs list has a second empty-state message.
 */
export const NothingShowing: Story = {
  decorators: [withVisibleStatuses([])],
}
