// Generic StepCard state-variant stories. Per-command usage variants
// live in StepCard.<commandName>.stories.tsx files under the same
// directory — those are titled `Components/StepCard/Commands/<name>`.
// This file owns `Components/StepCard/States/*` so the two axes are
// never tangled in the Storybook sidebar.

import type { Meta, StoryObj } from "@storybook/react"
import type { Step } from "../../types"
import { StepCard } from "./StepCard"
import {
  InteractiveStoryProvider,
  LiveStepCard,
  makeStory,
} from "./StepCard.storyHelpers"

const meta: Meta<typeof StepCard> = {
  title: "Components/StepCard/States",
  component: StepCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof StepCard>

// Reference step used by every state variant. `keepLanguages` has
// enough field surface to make the body interesting without crowding
// the state-specific affordances (status badge, run progress, errors).
const referenceStep: Step = {
  id: "step_states_reference",
  alias: "Filter Languages",
  command: "keepLanguages",
  params: {
    sourcePath: "/mnt/input/media",
    audioLanguages: ["eng", "jpn"],
  },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

// Blank step — no command selected; shows the command-picker affordance.
export const Blank: Story = makeStory({
  id: "step_states_blank",
  alias: "",
  command: "",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

export const Idle: Story = makeStory(referenceStep)

export const Pending: Story = makeStory({
  ...referenceStep,
  id: "step_states_pending",
  alias: "Queued",
  status: "pending",
})

export const Running: Story = makeStory({
  ...referenceStep,
  id: "step_states_running",
  alias: "Processing...",
  status: "running",
  jobId: "job_demo",
})

// StatusBadge map: `status: "completed"` paints the green "completed"
// pill (StatusBadge.tsx line 8). `"success"` produces no badge — the
// runtime never writes it.
export const Completed: Story = makeStory({
  ...referenceStep,
  id: "step_states_completed",
  alias: "Completed",
  status: "completed",
})

// Info callout — StepCard.tsx:358-363 renders the "No items reported"
// notice only when status === "completed" AND hasResults === false.
// This is the success-with-no-work-to-do shape (e.g. a filter step
// matched zero files).
export const CompletedNoResults: Story = makeStory({
  ...referenceStep,
  id: "step_states_completed_empty",
  alias: "Completed (No Items)",
  status: "completed",
  hasResults: false,
})

// StatusBadge map: `status: "failed"` paints the red "failed" pill. The
// `error` string appears below as the red callout.
export const Failed: Story = makeStory({
  ...referenceStep,
  id: "step_states_failed",
  alias: "Failed",
  status: "failed",
  error: "FFmpeg exited with code 1: Invalid audio codec",
})

export const Cancelled: Story = makeStory({
  ...referenceStep,
  id: "step_states_cancelled",
  alias: "Cancelled",
  status: "cancelled",
})

export const Skipped: Story = makeStory({
  ...referenceStep,
  id: "step_states_skipped",
  alias: "Skipped",
  status: "skipped",
})

// Planned early-exit (exitIfEmpty etc.) — distinct indigo "exited" pill
// in StatusBadge.tsx:16 so it reads as "informational terminal" rather
// than success/fail/skip.
export const Exited: Story = makeStory({
  ...referenceStep,
  id: "step_states_exited",
  alias: "Exited Early",
  status: "exited",
})

export const Collapsed: Story = makeStory({
  ...referenceStep,
  id: "step_states_collapsed",
  alias: "Hidden Fields",
  isCollapsed: true,
})

// Multi-step layout — exercises move-up/move-down and drag-reorder
// against a real DndContext + SortableContext.
export const InASequence: Story = {
  render: () => {
    const steps: Step[] = [
      { ...referenceStep, id: "step_seq_1" },
      {
        ...referenceStep,
        id: "step_seq_2",
        alias: "Tag Audio Language",
        command: "changeTrackLanguages",
        params: {
          sourcePath: "/mnt/input/series",
          audioLanguage: "eng",
        },
      },
      {
        ...referenceStep,
        id: "step_seq_3",
        alias: "Create Output Folder",
        command: "makeDirectory",
        params: { sourcePath: "/mnt/output" },
      },
    ]
    return (
      <InteractiveStoryProvider steps={steps}>
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <LiveStepCard
              key={step.id}
              stepId={step.id}
              index={idx}
              isFirst={idx === 0}
              isLast={idx === steps.length - 1}
            />
          ))}
        </div>
      </InteractiveStoryProvider>
    )
  },
}
