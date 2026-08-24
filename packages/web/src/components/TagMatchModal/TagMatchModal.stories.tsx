import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useState } from "react"
import { TagMatchModal } from "./TagMatchModal"
import {
  type TagMatchModalState,
  tagMatchModalAtom,
} from "./tagMatchModalAtom"
import type {
  ScoredReleaseCandidate,
  TagMatchFile,
} from "./tagMatchTypes"

// Fixture data only — no story fetches anything.
const buildCandidate = ({
  confidence,
  country,
  proposedTitle,
  proposedTrackNumber,
  releaseId,
  releaseTitle,
  source,
  year,
}: {
  confidence: number
  country?: string
  proposedTitle: string
  proposedTrackNumber: number
  releaseId: string
  releaseTitle: string
  source?: "musicbrainz" | "vgmdb"
  year?: string
}): ScoredReleaseCandidate => ({
  candidate: {
    artistName: "Nova Harbour",
    country,
    format: "CD",
    label: "Tidewater Records",
    releaseId,
    releaseTitle,
    source: source ?? "musicbrainz",
    trackCount: 11,
    year,
  },
  confidence,
  proposedTags: {
    album: releaseTitle,
    albumArtist: "Nova Harbour",
    artist: "Nova Harbour",
    date: year,
    genres: ["Ambient", "Downtempo"],
    title: proposedTitle,
    totalTracks: 11,
    trackNumber: proposedTrackNumber,
  },
})

const highConfidenceFiles: TagMatchFile[] = [
  {
    filePath: "/music/inbox/01 harbour lights.flac",
    filename: "01 harbour lights.flac",
    extension: ".flac",
    durationSeconds: 254,
    currentTags: {
      album: "Harbour Lights",
      artist: "Nova Harbour",
      title: "harbour lights",
      trackNumber: "01",
    },
    rankedCandidates: [
      buildCandidate({
        confidence: 0.94,
        country: "GB",
        proposedTitle: "Harbour Lights",
        proposedTrackNumber: 1,
        releaseId: "release-gb-cd",
        releaseTitle: "Harbour Lights",
        year: "2019",
      }),
      buildCandidate({
        confidence: 0.71,
        country: "JP",
        proposedTitle: "Harbour Lights",
        proposedTrackNumber: 1,
        releaseId: "release-jp-cd",
        releaseTitle: "Harbour Lights (Japan)",
        year: "2019",
      }),
    ],
  },
  {
    filePath: "/music/inbox/02 tidewater.flac",
    filename: "02 tidewater.flac",
    extension: ".flac",
    durationSeconds: 311,
    currentTags: {
      album: "Harbour Lights",
      artist: "Nova Harbour",
      title: "tidewater",
      trackNumber: "02",
    },
    rankedCandidates: [
      buildCandidate({
        confidence: 0.88,
        country: "GB",
        proposedTitle: "Tidewater",
        proposedTrackNumber: 2,
        releaseId: "release-gb-cd",
        releaseTitle: "Harbour Lights",
        year: "2019",
      }),
    ],
  },
]

const mixedConfidenceFiles: TagMatchFile[] = [
  ...highConfidenceFiles,
  {
    filePath: "/music/inbox/03 unknown track.flac",
    filename: "03 unknown track.flac",
    extension: ".flac",
    durationSeconds: 198,
    currentTags: {
      artist: "Nova Harbour",
      title: "unknown track",
    },
    rankedCandidates: [
      buildCandidate({
        confidence: 0.65,
        country: "US",
        proposedTitle: "Signal Fires",
        proposedTrackNumber: 3,
        releaseId: "release-us-digital",
        releaseTitle: "Harbour Lights (Deluxe)",
        year: "2020",
      }),
    ],
  },
]

const unmatchedFiles: TagMatchFile[] = [
  {
    filePath: "/music/inbox/track01.mp3",
    filename: "track01.mp3",
    extension: ".mp3",
    durationSeconds: 122,
    currentTags: { title: "track01" },
    rankedCandidates: [
      buildCandidate({
        confidence: 0.18,
        proposedTitle: "Lantern Quest Theme",
        proposedTrackNumber: 1,
        releaseId: "release-vgmdb-1",
        releaseTitle: "Lantern Quest Original Soundtrack",
        source: "vgmdb",
        year: "2016",
      }),
    ],
  },
  {
    filePath: "/music/inbox/track02.mp3",
    filename: "track02.mp3",
    extension: ".mp3",
    durationSeconds: 143,
    currentTags: { title: "track02" },
    rankedCandidates: [],
  },
]

const buildPayload = ({
  files,
  jobId,
}: {
  files: TagMatchFile[]
  jobId: string
}): TagMatchModalState => ({
  jobId,
  stepId: "step-1",
  sourcePath: "/music/inbox",
  files,
})

const highConfidencePayload = buildPayload({
  files: highConfidenceFiles,
  jobId: "job-high",
})
const mixedConfidencePayload = buildPayload({
  files: mixedConfidenceFiles,
  jobId: "job-mixed",
})
const unmatchedPayload = buildPayload({
  files: unmatchedFiles,
  jobId: "job-unmatched",
})
const emptyPayload = buildPayload({
  files: [],
  jobId: "job-empty",
})

const ReOpenButton = ({
  initialState,
}: {
  initialState: TagMatchModalState
}) => {
  const setState = useSetAtom(tagMatchModalAtom)

  return (
    <div className="p-4">
      <button
        type="button"
        className="rounded bg-surface-sunken px-3 py-1.5 text-xs text-content-primary"
        onClick={() => {
          setState(initialState)
        }}
      >
        Re-open Tag Match
      </button>
    </div>
  )
}

const meta: Meta<typeof TagMatchModal> = {
  title: "Modals/TagMatchModal",
  component: TagMatchModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as TagMatchModalState
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(tagMatchModalAtom, initialState)
        return newStore
      })

      return (
        <Provider store={store}>
          <Story />
        </Provider>
      )
    },
  ],
  parameters: { initialState: mixedConfidencePayload },
}
export default meta

type Story = StoryObj<typeof TagMatchModal>

// Every row is at or above Picard's file_lookup_threshold (0.7), so
// every row starts checked.
export const HighConfidence: Story = {
  parameters: { initialState: highConfidencePayload },
  render: () => (
    <>
      <ReOpenButton initialState={highConfidencePayload} />
      <TagMatchModal />
    </>
  ),
}

// The common case. The third row scores 0.65 — above SmartMatch's 0.6
// but below the music threshold of 0.7 — so it starts unchecked. This
// story is the visible proof that the two thresholds are not shared.
export const MixedConfidence: Story = {
  parameters: { initialState: mixedConfidencePayload },
  render: () => (
    <>
      <ReOpenButton initialState={mixedConfidencePayload} />
      <TagMatchModal />
    </>
  ),
}

// Everything below track_matching_threshold (0.4). Nothing is
// pre-checked and the badges read "Unmatched".
export const Unmatched: Story = {
  parameters: { initialState: unmatchedPayload },
  render: () => (
    <>
      <ReOpenButton initialState={unmatchedPayload} />
      <TagMatchModal />
    </>
  ),
}

// Opens with the first row already expanded, so the per-field diff is
// reviewable on load. This is the replacement for Picard's tag
// difference view.
export const ExpandedRowShowingDiff: Story = {
  parameters: { initialState: mixedConfidencePayload },
  render: () => (
    <>
      <ReOpenButton initialState={mixedConfidencePayload} />
      <TagMatchModal />
    </>
  ),
  play: ({ canvasElement }) => {
    const expandButton =
      canvasElement.ownerDocument.querySelector(
        '[data-tag-match-expand="/music/inbox/01 harbour lights.flac"]',
      ) as HTMLButtonElement | null
    if (expandButton) {
      expandButton.click()
    }
  },
}

// Opens with the bulk-edit disclosure already open — the MP3Tag half:
// set one field across every included row, and find-and-replace over a
// field.
export const BulkEditOpen: Story = {
  parameters: { initialState: mixedConfidencePayload },
  render: () => (
    <>
      <ReOpenButton initialState={mixedConfidencePayload} />
      <TagMatchModal />
    </>
  ),
  play: ({ canvasElement }) => {
    const bulkToggle =
      canvasElement.ownerDocument.querySelector(
        "[data-tag-match-bulk-toggle]",
      ) as HTMLButtonElement | null
    if (bulkToggle) {
      bulkToggle.click()
    }
  },
}

// Defensive: the trigger fired with no files.
export const Empty: Story = {
  parameters: { initialState: emptyPayload },
  render: () => (
    <>
      <ReOpenButton initialState={emptyPayload} />
      <TagMatchModal />
    </>
  ),
}
