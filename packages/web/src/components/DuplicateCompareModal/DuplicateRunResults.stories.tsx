import type { Meta, StoryObj } from "@storybook/react"

import { DuplicateRunResults } from "./DuplicateRunResults"
import { buildDuplicateGroup } from "./duplicateFixtures"

const meta: Meta<typeof DuplicateRunResults> = {
  title: "Components/DuplicateRunResults",
  component: DuplicateRunResults,
  parameters: { layout: "padded" },
  args: {
    jobId: "job-1",
    sourcePath: "/library",
    stepId: "step-1",
  },
}
export default meta

type Story = StoryObj<typeof DuplicateRunResults>

// One group found. The count says plainly that nothing has moved, because
// the command only ever reports.
export const OneGroup: Story = {
  args: { groups: [buildDuplicateGroup()] },
}

export const SeveralGroups: Story = {
  args: {
    groups: [
      buildDuplicateGroup({ groupKey: "group-1" }),
      buildDuplicateGroup({
        groupKey: "group-2",
        matchReason: "fingerprint",
      }),
      buildDuplicateGroup({
        groupKey: "group-3",
        matchReason: "tags",
      }),
    ],
  },
}

// A clean library. The panel renders nothing at all rather than an empty
// box that invites a click.
export const NoDuplicates: Story = {
  args: { groups: [] },
}

// Without a resolved source path the server cannot mirror the folder
// structure into the holding folder, so the trigger is withheld rather
// than opening a table whose confirm would fail.
export const NoSourcePath: Story = {
  args: {
    groups: [buildDuplicateGroup()],
    sourcePath: null,
  },
}
