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
        <div className="bg-surface-raised max-w-2xl">
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

const DUPLICATE_GROUPS = [
  {
    copies: [
      {
        filePath:
          "/library/Nova Harbour/Tidewater/01 Slack Water.flac",
        info: {
          bitDepth: 16,
          codec: "FLAC",
          fileSizeBytes: 28_400_000,
          filePath:
            "/library/Nova Harbour/Tidewater/01 Slack Water.flac",
          hasEmbeddedCoverArt: false,
          sampleRate: 44_100,
        },
        isLossless: true,
        isRecommendedKeep: true,
        rankReasons: ["lossless: lossless"],
      },
      {
        filePath:
          "/library/Nova Harbour/Tidewater/01 Slack Water.mp3",
        info: {
          codec: "MP3",
          fileSizeBytes: 8_100_000,
          filePath:
            "/library/Nova Harbour/Tidewater/01 Slack Water.mp3",
          hasEmbeddedCoverArt: false,
        },
        isLossless: false,
        isRecommendedKeep: false,
        rankReasons: [],
      },
    ],
    groupKey: "audio-1",
    isDuplicateGroup: true as const,
    matchReason: "audio" as const,
  },
]

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
    duplicateGroups: [],
    fingerprintMatches: [],
    musicMatchFiles: [],
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

// The no-TMDB sibling (`onlyNameSpecialFeaturesDvdCompare`), which
// until now emitted no summary trailer at all — so its leftovers showed
// up as bare "skipped" log lines and the ✨ Fix Unnamed button never
// appeared, even though the DVDCompare candidate list was right there.
// It now emits the same trailer shape as the TMDB command, so this
// story is the same panel driven by that command name: proof the button
// renders, and that `GenericRunResults` stays out of the way instead of
// listing the renames a second time.
export const DoneNoTmdbWithLeftovers: Story = {
  args: {
    commandName: "onlyNameSpecialFeaturesDvdCompare",
    isRunning: false,
    sourcePath: "G:\\Disc-Rips\\Live Concert Film - Bonus",
    renamePairs: [
      {
        oldName: "Concert_t02",
        newName: "Soundcheck Rehearsal -featurette",
      },
    ],
    // Non-null so the generic panel would have something to render if
    // it were still claiming this command.
    results: [
      {
        oldName: "Concert_t02",
        newName: "Soundcheck Rehearsal -featurette",
      },
    ],
    summary: {
      unrenamedFilenames: ["Concert_t04", "Concert_t07"],
      possibleNames: [
        { name: "Backstage Featurette" },
        { name: "Tour Photo Gallery" },
      ],
      unnamedFileCandidates: [
        {
          filename: "Concert_t04",
          extension: ".mkv",
          durationSeconds: 412,
          rankedCandidates: [
            {
              candidate: {
                name: "Backstage Featurette",
                timecode: undefined,
              },
              confidence: 0.55,
              durationScore: Number.NaN,
              filenameScore: 0,
            },
          ],
        },
        {
          filename: "Concert_t07",
          extension: ".mkv",
          durationSeconds: 96,
          rankedCandidates: [
            {
              candidate: {
                name: "Tour Photo Gallery",
                timecode: undefined,
              },
              confidence: 0.2,
              durationScore: Number.NaN,
              filenameScore: 0,
            },
          ],
        },
      ],
    },
  },
  decorators: [withLogs(sampleLogLines.slice(0, 4))],
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

// A `matchMusicBrainzRelease` run. The music panel replaces the NSF one
// on this card, and its trigger is the only door into the tag review
// table — nothing has been written at this point.
export const MusicMatchDone: Story = {
  args: {
    commandName: "matchMusicBrainzRelease",
    isRunning: false,
    musicMatchFiles: [
      {
        currentTags: { title: "Track 01", trackNumber: 1 },
        durationSeconds: 210,
        extension: ".flac",
        filePath: "/inbox/Long Way Down/01.flac",
        filename: "01.flac",
        rankedCandidates: [
          {
            candidate: {
              artistName: "Harbour Lights",
              country: "US",
              format: "CD",
              releaseId: "release-1",
              releaseTitle: "Long Way Down",
              source: "musicbrainz",
              trackCount: 12,
              year: "2004",
            },
            confidence: 0.94,
            proposedTags: {
              album: "Long Way Down",
              title: "Anchor",
              trackNumber: 1,
            },
          },
        ],
      },
      {
        currentTags: {},
        durationSeconds: 96,
        extension: ".flac",
        filePath: "/inbox/Long Way Down/99 - hidden.flac",
        filename: "99 - hidden.flac",
        rankedCandidates: [],
      },
    ],
    renamePairs: [],
    sourcePath: "/inbox/Long Way Down",
    summary: null,
  },
  decorators: [
    withLogs([
      "[INFO] matchMusicBrainzRelease started",
      "[INFO] 2 audio files in 1 clusters.",
      "[INFO] done",
    ]),
  ],
}

// A finished duplicate run. The panel says plainly that nothing has been
// moved — the command only ever reports, and the compare table is where a
// human confirms.
export const DuplicatesDone: Story = {
  args: {
    commandName: "findDuplicateAudioFiles",
    duplicateGroups: DUPLICATE_GROUPS,
    isRunning: false,
    renamePairs: [],
    sourcePath: "/library",
    summary: null,
  },
}

// A finished `fingerprintAudioFiles` run. Submitting to AcoustID is a
// separate press, never part of the run — these are public database
// entries made under the owner's account.
export const FingerprintDone: Story = {
  args: {
    commandName: "fingerprintAudioFiles",
    fingerprintMatches: [
      {
        acoustId: "acoust-1",
        duration: 210.4,
        filePath:
          "/inbox/Nova Harbour/Tidewater/01 Slack Water.flac",
        filename: "01 Slack Water.flac",
        fingerprint: "AQAD",
        kind: "matched",
        recordings: [
          {
            artistNames: ["Nova Harbour"],
            durationSeconds: 210,
            musicBrainzArtistIds: ["artist-1"],
            recordingId: "recording-1",
            releaseGroupIds: ["release-group-1"],
            title: "Slack Water",
          },
        ],
        score: 0.97,
      },
    ],
    isRunning: false,
    renamePairs: [],
    sourcePath: "/inbox/Nova Harbour/Tidewater",
    summary: null,
  },
}
