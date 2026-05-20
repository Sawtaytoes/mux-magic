import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import type {
  NsfRenamePair,
  NsfSummaryRecord,
} from "./findNsfResults"
import { NsfRunResults } from "./NsfRunResults"

const STEP_ID = "step-3"
const JOB_ID = "nsf-job-1"

const withStore = (Story: React.ComponentType) => {
  const [store] = useState(() => createStore())
  return (
    <Provider store={store}>
      <div className="bg-slate-900 max-w-2xl p-4">
        <Story />
      </div>
    </Provider>
  )
}

const meta: Meta<typeof NsfRunResults> = {
  title: "Components/NsfRunResults",
  component: NsfRunResults,
  args: {
    jobId: JOB_ID,
    stepId: STEP_ID,
    sourcePath: "/media/Shrek 2 - 4K",
  },
  decorators: [withStore],
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}
export default meta

type Story = StoryObj<typeof NsfRunResults>

const exampleRenames: NsfRenamePair[] = [
  {
    oldName: "Shrek 2-SF_02_t47",
    newName: "Secrets of Shrek 2 -featurette",
  },
  {
    oldName: "Shrek 2-SF_04_MV_02_TheseBoots_t50",
    newName:
      "These Boots Are Made for Walking Music Video by Puss in Boots -short",
  },
  {
    oldName: "Shrek 2-SF_04_MV_03_IKnowItsToday_t51",
    newName: "Shrek the Musical I Know It's Today -short",
  },
  {
    oldName: "Shrek 2_t04",
    newName: "Shrek 2 (2004)",
  },
]

const exampleSummary: NsfSummaryRecord = {
  unrenamedFilenames: [
    "Shrek 2-SF_01_SpotlightPussInBoots_t46",
    "Shrek 2-SF_03_FarAwayIdol_t48",
    "Shrek 2-SF_04_MV_01_Accidentally_t49",
  ],
  possibleNames: [
    {
      name: "Audio Commentary by Directors Kelly Asbury and Conrad Vernon",
    },
    {
      name: "Audio Commentary by Producer Aron Warner and Editor Mike Andrews",
    },
    {
      name: '"Shrek\'s Interactive Journey: II" Photo Gallery',
    },
  ],
  unnamedFileCandidates: [
    {
      filename: "Shrek 2-SF_01_SpotlightPussInBoots_t46",
      durationSeconds: 643.328,
      rankedCandidates: [
        {
          candidate: {
            name: "Spotlight on Puss in Boots Featurette",
            timecode: undefined,
          },
          confidence: 0.6,
          durationScore: Number.NaN,
          filenameScore: 1,
        },
        {
          candidate: {
            name: "Audio Commentary by Directors Kelly Asbury and Conrad Vernon",
            timecode: undefined,
          },
          confidence: 0,
          durationScore: Number.NaN,
          filenameScore: 0,
        },
      ],
    },
    {
      filename: "Shrek 2-SF_03_FarAwayIdol_t48",
      durationSeconds: 535.584,
      rankedCandidates: [
        {
          candidate: {
            name: "Far Far Away Idol",
            timecode: undefined,
          },
          confidence: 0.4,
          durationScore: Number.NaN,
          filenameScore: 0,
        },
      ],
    },
    {
      filename: "Shrek 2-SF_04_MV_01_Accidentally_t49",
      durationSeconds: 187.896,
      rankedCandidates: [
        {
          candidate: {
            name: "Accidentally in Love Music Video by Counting Crows",
            timecode: undefined,
          },
          confidence: 0.3,
          durationScore: Number.NaN,
          filenameScore: 0,
        },
      ],
    },
  ],
}

// Happy path: every file renamed cleanly, no leftover work to do.
export const AllRenamed: Story = {
  args: {
    renamePairs: exampleRenames,
    summary: {
      unrenamedFilenames: [],
      possibleNames: [],
    },
  },
}

// Mixed: some files renamed, others left over with smart-match
// candidates. The Fix Unnamed button is enabled because both
// `unnamedFileCandidates` and `sourcePath` are present.
export const MixedWithCandidates: Story = {
  args: {
    renamePairs: exampleRenames,
    summary: exampleSummary,
  },
}

// Leftover files exist but DVDCompare yielded no untimed suggestions.
// Each unnamedFileCandidate carries an empty `rankedCandidates` array —
// the modal still opens so the user can rename manually via the text
// inputs (see SmartMatchModal's no-candidates branch).
export const LeftoversWithNoCandidates: Story = {
  args: {
    renamePairs: exampleRenames.slice(0, 2),
    summary: {
      unrenamedFilenames: [
        "Shrek 2-SF_01_SpotlightPussInBoots_t46",
        "Shrek 2-SF_03_FarAwayIdol_t48",
      ],
      possibleNames: [],
      unnamedFileCandidates: [
        {
          filename:
            "Shrek 2-SF_01_SpotlightPussInBoots_t46",
          durationSeconds: 643,
          rankedCandidates: [],
        },
        {
          filename: "Shrek 2-SF_03_FarAwayIdol_t48",
          durationSeconds: 535,
          rankedCandidates: [],
        },
      ],
    },
  },
}

// Source path missing (e.g. step has no resolvable sourcePath) — the
// Fix Unnamed button stays hidden because the modal couldn't construct
// rename targets without an absolute folder.
export const NoSourcePath: Story = {
  args: {
    renamePairs: exampleRenames,
    summary: exampleSummary,
    sourcePath: null,
  },
}

// Renames only; no summary record (e.g. a non-NSF command that emits
// the same {oldName, newName} shape). Counts paragraph stays hidden
// because there's no summary to count against.
export const RenamesOnlyNoSummary: Story = {
  args: {
    renamePairs: exampleRenames,
    summary: null,
  },
}

// Nothing to show — component renders null so the host doesn't reserve
// vertical space.
export const Empty: Story = {
  args: {
    renamePairs: [],
    summary: null,
  },
}
