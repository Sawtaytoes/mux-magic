import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import {
  type LogEntry,
  logsByJobIdAtom,
} from "../../state/logsByJobIdAtom"
import type {
  NsfRenamePair,
  NsfSummaryRecord,
} from "../NsfRunResults/findNsfResults"
import { StepRunProgressView } from "./StepRunProgressView"

const STEP_ID = "step-1"
const JOB_ID = "step-job-shrek2"

const renderLogLines = (lines: string[]): LogEntry[] =>
  lines.map((line, index) => ({
    key: String(index),
    line,
  }))

const withLogs =
  (lines: string[]) => (Story: React.ComponentType) => {
    const [store] = useState(() => {
      const newStore = createStore()
      newStore.set(
        logsByJobIdAtom,
        new Map([[JOB_ID, renderLogLines(lines)]]),
      )
      return newStore
    })
    return (
      <Provider store={store}>
        <div className="bg-slate-800 max-w-2xl">
          <Story />
        </div>
      </Provider>
    )
  }

const sampleLogLines = [
  "[01:20:00.643] [LOADING] DVDCompare page",
  "[01:20:04.582] [SCRAPED EXTRAS] 1279 chars, 26 non-empty lines",
  "[01:20:04.583] [PARSED EXTRAS] 15 extras (13 with timecodes), 2 cuts, 11 untimed suggestions",
  "[01:20:10.821] [RENAMING] Renaming matched files (4 of 7)",
  '[01:20:10.821] [ALREADY NAMED] "Shrek the Musical I Know It\'s Today -short" is already at its target name.',
]

const sampleRenames: NsfRenamePair[] = [
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
    oldName: "Shrek 2_t04",
    newName: "Shrek 2 (2004)",
  },
]

const sampleSummary: NsfSummaryRecord = {
  unrenamedFilenames: [
    "Shrek 2-SF_01_SpotlightPussInBoots_t46",
    "Shrek 2-SF_03_FarAwayIdol_t48",
    "Shrek 2-SF_04_MV_01_Accidentally_t49",
  ],
  possibleNames: [
    {
      name: "Audio Commentary by Directors Kelly Asbury and Conrad Vernon",
    },
  ],
  unnamedFileCandidates: [
    {
      filename: "Shrek 2-SF_01_SpotlightPussInBoots_t46",
      durationSeconds: 643,
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
      ],
    },
    {
      filename: "Shrek 2-SF_03_FarAwayIdol_t48",
      durationSeconds: 535,
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
      durationSeconds: 188,
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

const meta: Meta<typeof StepRunProgressView> = {
  title: "Components/StepCard/StepRunProgressView",
  component: StepRunProgressView,
  args: {
    jobId: JOB_ID,
    stepId: STEP_ID,
    commandName: "nameSpecialFeaturesDvdCompareTmdb",
    sourcePath: "G:\\Disc-Rips\\Shrek 2 - 4K",
    snap: {},
    convertLosslessResults: { converted: [], skipped: [] },
    results: null,
  },
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}
export default meta

type Story = StoryObj<typeof StepRunProgressView>

// Active run — progress bar visible, no NSF summary yet (still in
// flight), logs streaming in.
export const Running: Story = {
  args: {
    isRunning: true,
    snap: {
      ratio: 0.42,
      filesDone: 3,
      filesTotal: 7,
      bytesPerSecond: 8_000_000,
      bytesRemaining: 55_000_000,
    },
    renamePairs: [],
    summary: null,
  },
  decorators: [withLogs(sampleLogLines.slice(0, 3))],
}

// Done with renames + leftovers + smart-match button visible. The
// post-run state the user actually cares about — verifies the diff-
// styled rename pairs, yellow leftover block, and ✨ Fix Unnamed
// button all render together.
export const DoneWithRenamesAndLeftovers: Story = {
  args: {
    isRunning: false,
    renamePairs: sampleRenames,
    summary: sampleSummary,
  },
  decorators: [withLogs(sampleLogLines)],
}

// Happy path — every file renamed, no leftovers.
export const DoneAllRenamed: Story = {
  args: {
    isRunning: false,
    renamePairs: sampleRenames,
    summary: {
      unrenamedFilenames: [],
      possibleNames: [],
    },
  },
  decorators: [withLogs(sampleLogLines)],
}

// Re-run on already-renamed folder. Empty rename list + no leftovers
// — the "ALREADY NAMED" branch from the server logs into the no-op
// flow; the report panel collapses to "Renamed 0. Files not renamed:
// 0." (or null when both empty — see NsfRunResults early-return).
export const DoneNothingChanged: Story = {
  args: {
    isRunning: false,
    renamePairs: [],
    summary: {
      unrenamedFilenames: [],
      possibleNames: [],
    },
  },
  decorators: [withLogs(sampleLogLines)],
}

// After the user clicked Apply in Smart Match for two of the three
// leftover files. The rename-pairs list grew to include both
// SmartMatch-applied renames (Spotlight on Puss in Boots + Far Far
// Away Idol) and the original NSF rename. The "Files not renamed:"
// block shrank to the single remaining file. The Fix Unnamed button
// would still show because that one file is still unrenamed. This is
// the state the user reported missing — verifies the
// `mergeAppliedRenamesIntoNsfResults` round-trip end-to-end at the
// presentation layer (the host components do the actual atom read +
// merge before passing props down).
export const DoneAfterSmartMatchApply: Story = {
  args: {
    isRunning: false,
    renamePairs: sampleRenames.concat([
      {
        oldName: "Shrek 2-SF_01_SpotlightPussInBoots_t46",
        newName: "Spotlight on Puss in Boots Featurette",
      },
      {
        oldName: "Shrek 2-SF_03_FarAwayIdol_t48",
        newName: "Far Far Away Idol",
      },
    ]),
    summary: {
      unrenamedFilenames: [
        "Shrek 2-SF_04_MV_01_Accidentally_t49",
      ],
      possibleNames: sampleSummary.possibleNames,
      unnamedFileCandidates: [
        {
          filename: "Shrek 2-SF_04_MV_01_Accidentally_t49",
          durationSeconds: 188,
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
    },
  },
  decorators: [withLogs(sampleLogLines)],
}

// convertLosslessToFlac audit-only on a mixed folder — the regression
// case: 2 compatible files (audit-only skipped) + 3 float-pcm skipped.
// Hidden audit-only records previously made this look like "5 skipped
// — all float" which was a lie of omission. Now reads "2 would convert
// • 3 would skip" with both lists visible.
export const ConvertLosslessAuditMixed: Story = {
  args: {
    isRunning: false,
    renamePairs: [],
    summary: null,
    sourcePath:
      "G:\\Music\\Lorien Testard\\Clair Obscur_ Expedition 33_ Original Soundtrack",
    convertLosslessResults: {
      converted: [],
      skipped: [
        {
          kind: "skipped",
          source:
            "G:\\Music\\Lorien Testard\\1-15 Get up!.wav",
          reason: "audit-only",
        },
        {
          kind: "skipped",
          source:
            "G:\\Music\\Lorien Testard\\1-17 Battling Breeze.wav",
          reason: "audit-only",
        },
        {
          kind: "skipped",
          source:
            "G:\\Music\\Lorien Testard\\1-01 Alicia.wav",
          reason: "float-pcm",
        },
        {
          kind: "skipped",
          source:
            "G:\\Music\\Lorien Testard\\1-02 Gustave.wav",
          reason: "float-pcm",
        },
        {
          kind: "skipped",
          source: "G:\\Music\\SACD\\disc-01.dff",
          reason: "dsd",
        },
      ],
    },
  },
  decorators: [
    withLogs([
      "[SKIPPED FLAC SOURCE] audit-only: 1-15 Get up!.wav",
      "[SKIPPED FLAC SOURCE] audit-only: 1-17 Battling Breeze.wav",
      "[SKIPPED FLAC SOURCE] float-pcm: 1-01 Alicia.wav",
      "[SKIPPED FLAC SOURCE] float-pcm: 1-02 Gustave.wav",
      "[SKIPPED FLAC SOURCE] dsd: disc-01.dff",
    ]),
  ],
}

// convertLosslessToFlac mixed-result run — the case the user hit on
// the Clair Obscur OST. Verifies counts row + per-reason grouped skip
// lists render together with a small converted list.
export const ConvertLosslessMixed: Story = {
  args: {
    isRunning: false,
    renamePairs: [],
    summary: null,
    sourcePath:
      "G:\\Music\\Lorien Testard\\Clair Obscur_ Expedition 33_ Original Soundtrack",
    convertLosslessResults: {
      converted: [
        {
          kind: "converted",
          source: "G:\\Music\\sample\\track-16bit.wav",
          destination:
            "G:\\Music\\sample\\track-16bit.flac",
        },
      ],
      skipped: [
        {
          kind: "skipped",
          source:
            "G:\\Music\\Lorien Testard\\1-01 Alicia.wav",
          reason: "float-pcm",
        },
        {
          kind: "skipped",
          source:
            "G:\\Music\\Lorien Testard\\1-02 Gustave.wav",
          reason: "float-pcm",
        },
        {
          kind: "skipped",
          source: "G:\\Music\\SACD\\disc-01.dff",
          reason: "dsd",
        },
      ],
    },
  },
  decorators: [
    withLogs([
      "[SKIPPED FLAC SOURCE] float-pcm: 1-01 Alicia.wav",
      "[SKIPPED FLAC SOURCE] float-pcm: 1-02 Gustave.wav",
      "[SKIPPED FLAC SOURCE] dsd: disc-01.dff",
      "[CREATED FLAC FILE] track-16bit.flac",
    ]),
  ],
}

// No NSF results at all — non-NSF command that produced log output
// but no oldName/newName emissions or summary. The View collapses to
// just the StepLogs block.
export const NonNsfCommand: Story = {
  args: {
    isRunning: false,
    renamePairs: [],
    summary: null,
    sourcePath: null,
  },
  decorators: [
    withLogs([
      "[INFO] copyFiles started",
      "[INFO] copied 3 files",
      "[INFO] done",
    ]),
  ],
}
