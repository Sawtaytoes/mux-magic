import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { RenameTargetPicker } from "./RenameTargetPicker"
import type { ScoredCandidate } from "./smartMatchTypes"

// Wraps the controlled picker in a host that owns the selectedName
// state — without it the picker would never update on selection
// because its `selectedName` prop is read-only.
const PickerHost = (args: {
  candidates: ScoredCandidate[]
  initialName: string
  isDisabled: boolean
}) => {
  const [selectedName, setSelectedName] = useState(
    args.initialName,
  )
  return (
    <div className="bg-slate-900 max-w-md p-4">
      <RenameTargetPicker
        candidates={args.candidates}
        selectedName={selectedName}
        onSelect={setSelectedName}
        isDisabled={args.isDisabled}
        ariaLabel="Pick a rename target"
      />
      <p className="mt-3 text-[11px] text-slate-400 font-mono">
        selected: {selectedName || "—"}
      </p>
    </div>
  )
}

const meta: Meta<typeof PickerHost> = {
  title: "Components/RenameTargetPicker",
  component: PickerHost,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}
export default meta

type Story = StoryObj<typeof PickerHost>

// Parent-child pool — mirrors the actual Shrek 2 disc structure where
// "Shrek, Rattle & Roll:" is an untimed PARENT entry with three
// indented MUSIC-VIDEO children. The dropdown renders each child with
// a leading "↳" arrow, an "under <parent>" caption, and a left-border
// indent so the user sees the hierarchy DVDCompare itself shows. Best
// story for visually verifying the new parent-child treatment.
const parentChildCandidates: ScoredCandidate[] = [
  {
    candidate: {
      name: "Shrek, Rattle & Roll",
    },
    confidence: 0.2,
    durationScore: 0,
    filenameScore: 0.33,
  },
  {
    candidate: {
      name: "Accidentally in Love Music Video by Counting Crows",
      timecode: "3:22",
      parentName: "Shrek, Rattle & Roll",
    },
    confidence: 0.88,
    durationScore: 0.95,
    filenameScore: 0.6,
  },
  {
    candidate: {
      name: "These Boots Are Made for Walking Music Video by Puss in Boots",
      timecode: "2:17",
      parentName: "Shrek, Rattle & Roll",
    },
    confidence: 0.4,
    durationScore: 0.1,
    filenameScore: 0.55,
  },
  {
    candidate: {
      name: 'Shrek the Musical "I Know It\'s Today"',
      timecode: "5:36",
      parentName: "Shrek, Rattle & Roll",
    },
    confidence: 0.3,
    durationScore: 0,
    filenameScore: 0.45,
  },
  {
    candidate: {
      name: "Spotlight on Puss in Boots Featurette",
      timecode: "10:46",
    },
    confidence: 0.05,
    durationScore: 0,
    filenameScore: 0.1,
  },
]

// Mixed pool — high-confidence timecoded match at the top, then
// untimed entries lower down. Mirrors the shape SmartMatchModal sees
// for an unrenamed file where DVDCompare has both timecoded and
// untimed candidates.
const mixedCandidates: ScoredCandidate[] = [
  {
    candidate: {
      name: "Spotlight on Puss in Boots Featurette",
      timecode: "10:46",
    },
    confidence: 0.95,
    durationScore: 0.95,
    filenameScore: 0.8,
  },
  {
    candidate: {
      name: "Far Far Away Idol",
      timecode: "5:53",
    },
    confidence: 0.42,
    durationScore: 0.2,
    filenameScore: 0.55,
  },
  {
    candidate: {
      name: "Shrek, Rattle & Roll",
    },
    confidence: 0.2,
    durationScore: 0,
    filenameScore: 0.33,
  },
  {
    candidate: {
      name: "Audio Commentary by Directors Kelly Asbury and Conrad Vernon",
    },
    confidence: 0.0,
    durationScore: 0,
    filenameScore: 0,
  },
  {
    candidate: {
      name: "* The Film",
    },
    confidence: 0.0,
    durationScore: 0,
    filenameScore: 0,
  },
]

// Default: high-confidence timecoded candidate pre-selected so the
// trigger shows its full meta row (name + timecode chip + emerald
// confidence chip).
export const HighConfidencePreselected: Story = {
  args: {
    candidates: mixedCandidates,
    initialName: "Spotlight on Puss in Boots Featurette",
    isDisabled: false,
  },
  render: (args) => <PickerHost {...args} />,
}

// Low-confidence pre-selected → amber chip on the trigger, signals to
// the user that this row needs review before applying.
export const LowConfidencePreselected: Story = {
  args: {
    candidates: mixedCandidates,
    initialName: "Shrek, Rattle & Roll",
    isDisabled: false,
  },
  render: (args) => <PickerHost {...args} />,
}

// No timecode on the selected option — trigger omits the timecode
// chip; only the confidence chip renders.
export const UntimedPreselected: Story = {
  args: {
    candidates: mixedCandidates,
    initialName: "* The Film",
    isDisabled: false,
  },
  render: (args) => <PickerHost {...args} />,
}

// Empty selection — trigger shows the placeholder, no meta row.
// Models the "first render, nothing picked yet" state.
export const EmptySelection: Story = {
  args: {
    candidates: mixedCandidates,
    initialName: "",
    isDisabled: false,
  },
  render: (args) => <PickerHost {...args} />,
}

// Disabled — applied to rows that already succeeded (isApplied) or
// while the batch is mid-apply (isApplying). Cursor + opacity flip.
export const Disabled: Story = {
  args: {
    candidates: mixedCandidates,
    initialName: "Spotlight on Puss in Boots Featurette",
    isDisabled: true,
  },
  render: (args) => <PickerHost {...args} />,
}

// Parent-child rendering — child pre-selected so the trigger ALSO
// shows the "under <parent>" caption. Open the dropdown to see each
// child rendered with the ↳ arrow + indent + "under Shrek, Rattle &
// Roll" caption, matching the visual hierarchy DVDCompare itself
// publishes.
export const ChildPreselected: Story = {
  args: {
    candidates: parentChildCandidates,
    initialName:
      "Accidentally in Love Music Video by Counting Crows",
    isDisabled: false,
  },
  render: (args) => <PickerHost {...args} />,
}

// Parent-child rendering with the PARENT pre-selected. Use this to
// verify that the trigger does NOT show the "under" caption when the
// selection itself is top-level, while the dropdown still shows the
// children below it with their hierarchy markers.
export const ParentPreselected: Story = {
  args: {
    candidates: parentChildCandidates,
    initialName: "Shrek, Rattle & Roll",
    isDisabled: false,
  },
  render: (args) => <PickerHost {...args} />,
}

// Dense pool — mirrors a real Shrek 2 Blu-ray run where DVDCompare
// emits 12+ scored candidates. With the previous 192px PortalDropdown
// cap only ~4 options were visible at once; the bumped 480px cap
// (worker 71) surfaces roughly 9–10 of the two-row options before the
// scrollbar appears. Open the dropdown to verify. Resize the
// Storybook canvas to a narrow viewport to also confirm the
// viewport-aware clamp still kicks in below the cap.
const denseCandidates: ScoredCandidate[] = [
  {
    candidate: {
      name: "Spotlight on Puss in Boots Featurette",
      timecode: "10:46",
    },
    confidence: 0.95,
    durationScore: 0.95,
    filenameScore: 0.8,
  },
  {
    candidate: {
      name: "Far Far Away Idol",
      timecode: "5:53",
    },
    confidence: 0.78,
    durationScore: 0.7,
    filenameScore: 0.6,
  },
  {
    candidate: {
      name: "Meet the Cast Featurette",
      timecode: "8:12",
    },
    confidence: 0.62,
    durationScore: 0.55,
    filenameScore: 0.5,
  },
  {
    candidate: {
      name: "The Tech of Shrek 2 Featurette",
      timecode: "12:30",
    },
    confidence: 0.55,
    durationScore: 0.5,
    filenameScore: 0.45,
  },
  {
    candidate: { name: "Shrek, Rattle & Roll" },
    confidence: 0.2,
    durationScore: 0,
    filenameScore: 0.33,
  },
  {
    candidate: {
      name: "Accidentally in Love Music Video by Counting Crows",
      timecode: "3:22",
      parentName: "Shrek, Rattle & Roll",
    },
    confidence: 0.5,
    durationScore: 0.4,
    filenameScore: 0.45,
  },
  {
    candidate: {
      name: "These Boots Are Made for Walking Music Video by Puss in Boots",
      timecode: "2:17",
      parentName: "Shrek, Rattle & Roll",
    },
    confidence: 0.4,
    durationScore: 0.1,
    filenameScore: 0.55,
  },
  {
    candidate: {
      name: 'Shrek the Musical "I Know It\'s Today"',
      timecode: "5:36",
      parentName: "Shrek, Rattle & Roll",
    },
    confidence: 0.3,
    durationScore: 0,
    filenameScore: 0.45,
  },
  {
    candidate: {
      name: "Audio Commentary by Directors Kelly Asbury and Conrad Vernon",
    },
    confidence: 0.1,
    durationScore: 0,
    filenameScore: 0.1,
  },
  {
    candidate: { name: "* The Film" },
    confidence: 0.05,
    durationScore: 0,
    filenameScore: 0.05,
  },
  {
    candidate: { name: "Deleted Scenes", timecode: "9:00" },
    confidence: 0.25,
    durationScore: 0.2,
    filenameScore: 0.3,
  },
  {
    candidate: {
      name: "International Trailers Compilation",
      timecode: "4:15",
    },
    confidence: 0.15,
    durationScore: 0.1,
    filenameScore: 0.2,
  },
]

// Renders the dense pool so the bumped max-height (worker 71) is
// reviewable — open the dropdown and count visible options.
export const DenseCandidates: Story = {
  args: {
    candidates: denseCandidates,
    initialName: "Spotlight on Puss in Boots Featurette",
    isDisabled: false,
  },
  render: (args) => <PickerHost {...args} />,
}

// Dense pool inside a narrow viewport — wraps the picker in a
// short host so the viewport-aware clamp pins the dropdown below
// the cap. Confirms bumping the constant doesn't regress small
// viewports.
export const DenseCandidatesNarrowViewport: Story = {
  args: {
    candidates: denseCandidates,
    initialName: "Spotlight on Puss in Boots Featurette",
    isDisabled: false,
  },
  render: (args) => (
    <div style={{ height: 240, overflow: "auto" }}>
      <PickerHost {...args} />
    </div>
  ),
}

// Edge case: only one candidate. Useful for verifying that the
// picker doesn't gate itself off when the pool is single-entry.
export const SingleCandidate: Story = {
  args: {
    candidates: [
      {
        candidate: {
          name: "Spotlight on Puss in Boots Featurette",
          timecode: "10:46",
        },
        confidence: 0.95,
        durationScore: 0.95,
        filenameScore: 0.8,
      },
    ],
    initialName: "Spotlight on Puss in Boots Featurette",
    isDisabled: false,
  },
  render: (args) => <PickerHost {...args} />,
}
