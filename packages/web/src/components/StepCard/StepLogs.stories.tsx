import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import {
  type LogEntry,
  logsByJobIdAtom,
} from "../../state/logsByJobIdAtom"
import { StepLogs } from "./StepLogs"

const JOB_ID = "step-job-1"

const withLogs =
  (lines: string[]) => (Story: React.ComponentType) => {
    const [store] = useState(() => {
      const newStore = createStore()
      const entries: LogEntry[] = lines.map(
        (line, index) => ({
          key: String(index),
          line,
        }),
      )
      newStore.set(
        logsByJobIdAtom,
        new Map([[JOB_ID, entries]]),
      )
      return newStore
    })
    return (
      <Provider store={store}>
        <div className="bg-slate-900 max-w-2xl p-4">
          <Story />
        </div>
      </Provider>
    )
  }

const meta: Meta<typeof StepLogs> = {
  title: "Components/StepLogs",
  component: StepLogs,
  args: { jobId: JOB_ID },
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}
export default meta

type Story = StoryObj<typeof StepLogs>

const realisticNsfLogs = [
  "[01:20:00.643] [LOADING] DVDCompare page",
  "[01:20:04.582] [SCRAPED EXTRAS] 1279 chars, 26 non-empty lines",
  "[01:20:04.583] [PARSED EXTRAS] 15 extras (13 with timecodes), 2 cuts, 11 untimed suggestions",
  "[01:20:04.978] [READING FILE METADATA] padding=2, offset=0",
  "[01:20:05.087] [TIMECODE] These Boots Are Made for Walking Music Video by Puss in Boots -short 2:17",
  "[01:20:05.109] [TIMECODE] Shrek 2-SF_01_SpotlightPussInBoots_t46 10:43",
  "[01:20:05.112] [TIMECODE] Shrek the Musical I Know It's Today -short 5:38",
  "[01:20:10.821] [RENAMING] Renaming matched files (4 of 7)",
  "[01:20:10.821] [ALREADY NAMED] \"These Boots Are Made for Walking Music Video by Puss in Boots -short\" is already at its target name — nothing to do.",
  "[01:20:10.821] [ALREADY NAMED] \"Shrek the Musical I Know It's Today -short\" is already at its target name — nothing to do.",
]

// Default state — logs present but the body is collapsed so the card
// stays scannable. Header shows the line count.
export const Collapsed: Story = {
  decorators: [withLogs(realisticNsfLogs)],
}

// User clicked the chevron → log body is mounted. Note: Storybook
// can't pre-toggle the internal useState; this story documents what
// the expanded state looks like by recording the user gesture as the
// expected first interaction.
export const ManyLines: Story = {
  decorators: [
    withLogs(
      Array.from({ length: 60 }, (_, index) =>
        index === 0
          ? "[Step started]"
          : `[INFO] file ${index} processed`,
      ),
    ),
  ],
}

// No logs at all — component renders null. Included so designers can
// confirm the layout doesn't reserve space when there's nothing to
// show.
export const Empty: Story = {
  decorators: [withLogs([])],
}
