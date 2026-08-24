import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { ReleaseCandidatePicker } from "./ReleaseCandidatePicker"
import type { ScoredReleaseCandidate } from "./tagMatchTypes"

// Owns the selected release id — the picker's `selectedReleaseId` prop
// is a seed, so without a host it would never move.
const ReleaseCandidatePickerHost = (args: {
  candidates: ScoredReleaseCandidate[]
  initialReleaseId: string
  isDisabled: boolean
}) => {
  const [selectedReleaseId, setSelectedReleaseId] =
    useState(args.initialReleaseId)

  return (
    <div className="bg-surface-base max-w-md p-4">
      <ReleaseCandidatePicker
        ariaLabel="Release for 03 signal fires.flac"
        candidates={args.candidates}
        isDisabled={args.isDisabled}
        onSelect={setSelectedReleaseId}
        selectedReleaseId={selectedReleaseId}
      />
      <p className="mt-3 font-mono text-[11px] text-content-secondary">
        selected: {selectedReleaseId || "—"}
      </p>
    </div>
  )
}

const buildCandidate = ({
  artistName,
  confidence,
  country,
  format,
  label,
  releaseId,
  releaseTitle,
  source,
  trackCount,
  year,
}: {
  artistName: string
  confidence: number
  country?: string
  format?: string
  label?: string
  releaseId: string
  releaseTitle: string
  source: "musicbrainz" | "vgmdb"
  trackCount?: number
  year?: string
}): ScoredReleaseCandidate => ({
  candidate: {
    artistName,
    country,
    format,
    label,
    releaseId,
    releaseTitle,
    source,
    trackCount,
  },
  confidence,
  proposedTags: {
    album: releaseTitle,
    albumArtist: artistName,
    date: year,
  },
})

// Four releases of the same album — the case manual release search
// exists for. Country, format, year, track count and label are what
// separate them.
const fourCandidates: ScoredReleaseCandidate[] = [
  buildCandidate({
    artistName: "Nova Harbour",
    confidence: 0.92,
    country: "GB",
    format: "CD",
    label: "Tidewater Records",
    releaseId: "release-gb-cd",
    releaseTitle: "Harbour Lights",
    source: "musicbrainz",
    trackCount: 11,
    year: "2019",
  }),
  buildCandidate({
    artistName: "Nova Harbour",
    confidence: 0.74,
    country: "JP",
    format: "CD",
    label: "Tidewater Japan",
    releaseId: "release-jp-cd",
    releaseTitle: "Harbour Lights",
    source: "musicbrainz",
    trackCount: 13,
    year: "2019",
  }),
  buildCandidate({
    artistName: "Nova Harbour",
    confidence: 0.51,
    country: "US",
    format: "Digital Media",
    label: "Tidewater Records",
    releaseId: "release-us-digital",
    releaseTitle: "Harbour Lights (Deluxe)",
    source: "musicbrainz",
    trackCount: 15,
    year: "2020",
  }),
  buildCandidate({
    artistName: "Nova Harbour",
    confidence: 0.22,
    format: "Vinyl",
    releaseId: "release-vinyl",
    releaseTitle: "Harbour Lights",
    source: "musicbrainz",
    trackCount: 10,
    year: "2021",
  }),
]

// Six or more candidates switches the control to a searchable
// Combobox. A game soundtrack pool from VGMdb is the realistic case.
const manyCandidates: ScoredReleaseCandidate[] = [
  ...fourCandidates,
  buildCandidate({
    artistName: "Various Artists",
    confidence: 0.44,
    country: "JP",
    format: "2xCD",
    label: "Lantern Sound",
    releaseId: "release-vgmdb-1",
    releaseTitle: "Lantern Quest Original Soundtrack",
    source: "vgmdb",
    trackCount: 42,
    year: "2016",
  }),
  buildCandidate({
    artistName: "Various Artists",
    confidence: 0.31,
    country: "JP",
    format: "CD",
    label: "Lantern Sound",
    releaseId: "release-vgmdb-2",
    releaseTitle: "Lantern Quest Arrange Album",
    source: "vgmdb",
    trackCount: 12,
    year: "2017",
  }),
]

const meta: Meta<typeof ReleaseCandidatePickerHost> = {
  title: "Components/ReleaseCandidatePicker",
  component: ReleaseCandidatePickerHost,
  parameters: { layout: "padded" },
}
export default meta

type Story = StoryObj<typeof ReleaseCandidatePickerHost>

// Under six candidates: a Listbox, no search field.
export const FewCandidates: Story = {
  args: {
    candidates: fourCandidates,
    initialReleaseId: "release-gb-cd",
    isDisabled: false,
  },
  render: (args) => (
    <ReleaseCandidatePickerHost {...args} />
  ),
}

// Six or more: a Combobox, so the user can type instead of scanning.
export const ManyCandidatesSearchable: Story = {
  args: {
    candidates: manyCandidates,
    initialReleaseId: "release-gb-cd",
    isDisabled: false,
  },
  render: (args) => (
    <ReleaseCandidatePickerHost {...args} />
  ),
}

// Nothing picked yet — the trigger shows its placeholder.
export const NoSelection: Story = {
  args: {
    candidates: fourCandidates,
    initialReleaseId: "",
    isDisabled: false,
  },
  render: (args) => (
    <ReleaseCandidatePickerHost {...args} />
  ),
}

// Disabled — the row is already applied, or the batch is writing.
export const Disabled: Story = {
  args: {
    candidates: fourCandidates,
    initialReleaseId: "release-gb-cd",
    isDisabled: true,
  },
  render: (args) => (
    <ReleaseCandidatePickerHost {...args} />
  ),
}
