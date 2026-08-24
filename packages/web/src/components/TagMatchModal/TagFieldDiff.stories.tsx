import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { TagFieldDiff } from "./TagFieldDiff"
import type {
  AudioTagFieldName,
  TagValue,
} from "./tagMatchTypes"

// Owns the proposed value so the editable stories round-trip a typed
// edit the same way the modal's row state does.
const TagFieldDiffHost = (args: {
  fieldName: AudioTagFieldName
  currentValue: TagValue
  initialProposedValue: TagValue
  isEditable: boolean
}) => {
  const [proposedValue, setProposedValue] =
    useState<TagValue>(args.initialProposedValue)

  return (
    <div className="bg-surface-base max-w-2xl p-4">
      <TagFieldDiff
        currentValue={args.currentValue}
        fieldName={args.fieldName}
        isEditable={args.isEditable}
        onChange={setProposedValue}
        proposedValue={proposedValue}
      />
      <p className="mt-3 font-mono text-[11px] text-content-secondary">
        committed: {JSON.stringify(proposedValue)}
      </p>
    </div>
  )
}

const meta: Meta<typeof TagFieldDiffHost> = {
  title: "Components/TagFieldDiff",
  component: TagFieldDiffHost,
  parameters: { layout: "padded" },
}
export default meta

type Story = StoryObj<typeof TagFieldDiffHost>

// The quiet case. Most fields on a good match look like this, and they
// must not compete for attention with the fields that changed.
export const Unchanged: Story = {
  args: {
    fieldName: "album",
    currentValue: "Harbour Lights",
    initialProposedValue: "Harbour Lights",
    isEditable: false,
  },
  render: (args) => <TagFieldDiffHost {...args} />,
}

// Numbers compare numerically, so a zero-padded track number and the
// integer it means are the same value — not a change.
export const NumericUnchanged: Story = {
  args: {
    fieldName: "trackNumber",
    currentValue: "01",
    initialProposedValue: 1,
    isEditable: false,
  },
  render: (args) => <TagFieldDiffHost {...args} />,
}

export const Added: Story = {
  args: {
    fieldName: "albumArtist",
    currentValue: undefined,
    initialProposedValue: "Nova Harbour",
    isEditable: false,
  },
  render: (args) => <TagFieldDiffHost {...args} />,
}

export const Changed: Story = {
  args: {
    fieldName: "title",
    currentValue: "track 03",
    initialProposedValue: "Signal Fires",
    isEditable: false,
  },
  render: (args) => <TagFieldDiffHost {...args} />,
}

export const Removed: Story = {
  args: {
    fieldName: "composer",
    currentValue: "Unknown Composer",
    initialProposedValue: undefined,
    isEditable: false,
  },
  render: (args) => <TagFieldDiffHost {...args} />,
}

// Free-hand editing of any tag — the MP3Tag behaviour. `genres` edits
// as a comma-separated string and commits as an array; watch the
// "committed" line below the row.
export const EditableGenres: Story = {
  args: {
    fieldName: "genres",
    currentValue: ["Ambient"],
    initialProposedValue: ["Ambient", "Downtempo"],
    isEditable: true,
  },
  render: (args) => <TagFieldDiffHost {...args} />,
}
