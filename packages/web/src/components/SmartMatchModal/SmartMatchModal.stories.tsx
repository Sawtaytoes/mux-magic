import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useState } from "react"
import { SmartMatchModal } from "./SmartMatchModal"
import {
  type SmartMatchModalState,
  smartMatchModalAtom,
} from "./smartMatchModalAtom"
import type {
  FileSuggestion,
  ScoredCandidate,
} from "./smartMatchTypes"

// Worker 25: the modal now receives already-scored suggestions from
// the server payload — these stories no longer run the scorer. The
// helper below builds plausible ScoredCandidate entries by hand so
// the story files stay readable without copying scorer math.
const scored = (
  name: string,
  confidence: number,
  options: {
    timecode?: string
    durationScore?: number
    filenameScore?: number
    parentName?: string
  } = {},
): ScoredCandidate => ({
  candidate: {
    name,
    timecode: options.timecode,
    parentName: options.parentName,
  },
  confidence,
  durationScore: options.durationScore ?? Number.NaN,
  filenameScore: options.filenameScore ?? 0,
})

const ReOpenButton = ({
  initialState,
}: {
  initialState: SmartMatchModalState
}) => {
  const setState = useSetAtom(smartMatchModalAtom)
  return (
    <div className="p-4">
      <button
        type="button"
        className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded"
        onClick={() => setState(initialState)}
      >
        Re-open Smart Match
      </button>
    </div>
  )
}

const allHighConfidenceSuggestions: FileSuggestion[] = [
  {
    filename: "BONUS_1",
    extension: ".mkv",
    durationSeconds: 5400,
    rankedCandidates: [
      scored("Theatrical Cut", 0.7, {
        timecode: "1:30:00",
        durationScore: 1,
      }),
      scored("Trailer", 0, { timecode: "0:02:30" }),
    ],
  },
  {
    filename: "BONUS_2",
    extension: ".mkv",
    durationSeconds: 150,
    rankedCandidates: [
      scored("Trailer", 0.7, {
        timecode: "0:02:30",
        durationScore: 1,
      }),
      scored("Theatrical Cut", 0, { timecode: "1:30:00" }),
    ],
  },
]

const allHighConfidencePayload: SmartMatchModalState = {
  jobId: "job-high",
  stepId: "step-1",
  sourcePath: "/movies/Demo",
  suggestions: allHighConfidenceSuggestions,
}

const mixedConfidenceSuggestions: FileSuggestion[] = [
  {
    filename: "BONUS_1",
    extension: ".mkv",
    durationSeconds: 5400,
    rankedCandidates: [
      scored("Theatrical Cut", 0.7, {
        timecode: "1:30:00",
        durationScore: 1,
      }),
      scored("Image Gallery", 0),
      scored("Promotional Featurette", 0),
    ],
  },
  {
    filename: "image-gallery-disc1",
    extension: ".mkv",
    durationSeconds: 30,
    rankedCandidates: [
      scored("Image Gallery", 0.6, { filenameScore: 1 }),
      scored("Promotional Featurette", 0),
      scored("Theatrical Cut", 0, { timecode: "1:30:00" }),
    ],
  },
  {
    filename: "MOVIE_t99",
    extension: ".mkv",
    durationSeconds: 45,
    rankedCandidates: [
      scored("Image Gallery", 0),
      scored("Promotional Featurette", 0),
      scored("Theatrical Cut", 0, { timecode: "1:30:00" }),
    ],
  },
]

const mixedConfidencePayload: SmartMatchModalState = {
  jobId: "job-mixed",
  stepId: "step-1",
  sourcePath: "/movies/Demo",
  suggestions: mixedConfidenceSuggestions,
}

const allLowConfidencePayload: SmartMatchModalState = {
  jobId: "job-low",
  stepId: "step-1",
  sourcePath: "/movies/Demo",
  suggestions: [
    {
      filename: "MOVIE_t99",
      extension: ".mkv",
      durationSeconds: 45,
      rankedCandidates: [
        scored("Image Gallery", 0),
        scored("Promotional Featurette", 0),
      ],
    },
    {
      filename: "MOVIE_t100",
      extension: ".mkv",
      durationSeconds: 60,
      rankedCandidates: [
        scored("Image Gallery", 0),
        scored("Promotional Featurette", 0),
      ],
    },
  ],
}

// Mirrors the actual shape an NSF run on Shrek 2 (UHD Blu-ray) yields:
// 3 leftover files paired against a candidate pool that includes both
// timed extras (featurettes / music videos rejected as out of
// tolerance) and untimed entries (audio commentaries, photo gallery,
// jukebox).
const shrek2BluRayPayload: SmartMatchModalState = {
  jobId: "job-shrek2",
  stepId: "step-1",
  sourcePath: "G:\\Disc-Rips\\Shrek 2 - 4K",
  suggestions: [
    {
      filename: "Shrek 2-SF_01_SpotlightPussInBoots_t46",
      extension: ".mkv",
      durationSeconds: 643,
      rankedCandidates: [
        scored(
          "Spotlight on Puss in Boots Featurette",
          0.7,
          {
            timecode: "10:46",
            durationScore: 1,
            filenameScore: 0.66,
          },
        ),
        scored(
          "Audio Commentary by Directors Kelly Asbury and Conrad Vernon",
          0,
        ),
        scored(
          '"Shrek\'s Interactive Journey: II" Photo Gallery',
          0,
        ),
      ],
    },
    {
      filename: "Shrek 2-SF_04_MV_01_Accidentally_t49",
      extension: ".mkv",
      durationSeconds: 188,
      rankedCandidates: [
        scored(
          "Accidentally in Love Music Video by Counting Crows",
          0.65,
          {
            timecode: "3:22",
            parentName: "Shrek, Rattle & Roll",
            durationScore: 0.85,
            filenameScore: 0.4,
          },
        ),
        scored(
          "These Boots Are Made for Walking Music Video by Puss in Boots",
          0,
          {
            timecode: "2:17",
            parentName: "Shrek, Rattle & Roll",
          },
        ),
      ],
    },
    {
      filename: "Shrek 2-SF_03_FarAwayIdol_t48",
      extension: ".mkv",
      durationSeconds: 536,
      rankedCandidates: [
        scored("Far Far Away Idol", 0.7, {
          timecode: "5:53",
          durationScore: 1,
          filenameScore: 0.5,
        }),
        scored("Spotlight on Puss in Boots Featurette", 0, {
          timecode: "10:46",
        }),
      ],
    },
  ],
}

const emptyPayload: SmartMatchModalState = {
  jobId: "job-empty",
  stepId: "step-1",
  sourcePath: "/movies/Demo",
  suggestions: [],
}

const meta: Meta<typeof SmartMatchModal> = {
  title: "Modals/SmartMatchModal",
  component: SmartMatchModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as SmartMatchModalState
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(smartMatchModalAtom, initialState)
        return newStore
      })
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      )
    },
  ],
  parameters: {
    initialState: mixedConfidencePayload,
  },
}
export default meta

type Story = StoryObj<typeof SmartMatchModal>

export const AllHighConfidence: Story = {
  parameters: { initialState: allHighConfidencePayload },
  render: () => (
    <>
      <ReOpenButton
        initialState={allHighConfidencePayload}
      />
      <SmartMatchModal />
    </>
  ),
}

export const Mixed: Story = {
  parameters: { initialState: mixedConfidencePayload },
  render: () => (
    <>
      <ReOpenButton initialState={mixedConfidencePayload} />
      <SmartMatchModal />
    </>
  ),
}

export const AllLowConfidence: Story = {
  parameters: { initialState: allLowConfidencePayload },
  render: () => (
    <>
      <ReOpenButton
        initialState={allLowConfidencePayload}
      />
      <SmartMatchModal />
    </>
  ),
}

export const Empty: Story = {
  parameters: { initialState: emptyPayload },
  render: () => (
    <>
      <ReOpenButton initialState={emptyPayload} />
      <SmartMatchModal />
    </>
  ),
}

// Real-world disc shape (Shrek 2 UHD Blu-ray). Best story for
// validating the styled RenameTargetPicker's two-row option layout —
// each candidate's optional timecode chip is visible alongside the
// confidence chip.
export const Shrek2BluRayDiscShape: Story = {
  parameters: { initialState: shrek2BluRayPayload },
  render: () => (
    <>
      <ReOpenButton initialState={shrek2BluRayPayload} />
      <SmartMatchModal />
    </>
  ),
}
