import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useState } from "react"
import { SmartMatchModal } from "./SmartMatchModal"
import {
  type SmartMatchModalState,
  smartMatchModalAtom,
} from "./smartMatchModalAtom"

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

const allHighConfidencePayload: SmartMatchModalState = {
  jobId: "job-high",
  stepId: "step-1",
  sourcePath: "/movies/Demo",
  unrenamedFiles: [
    {
      filename: "BONUS_1.mkv",
      durationSeconds: 5400,
    },
    {
      filename: "BONUS_2.mkv",
      durationSeconds: 150,
    },
  ],
  candidates: [
    { name: "Theatrical Cut", timecode: "1:30:00" },
    { name: "Trailer", timecode: "0:02:30" },
  ],
}

const mixedConfidencePayload: SmartMatchModalState = {
  jobId: "job-mixed",
  stepId: "step-1",
  sourcePath: "/movies/Demo",
  unrenamedFiles: [
    {
      filename: "BONUS_1.mkv",
      durationSeconds: 5400,
    },
    {
      filename: "image-gallery-disc1.mkv",
      durationSeconds: 30,
    },
    {
      filename: "MOVIE_t99.mkv",
      durationSeconds: 45,
    },
  ],
  candidates: [
    { name: "Theatrical Cut", timecode: "1:30:00" },
    { name: "Image Gallery", timecode: undefined },
    { name: "Promotional Featurette", timecode: undefined },
  ],
}

const allLowConfidencePayload: SmartMatchModalState = {
  jobId: "job-low",
  stepId: "step-1",
  sourcePath: "/movies/Demo",
  unrenamedFiles: [
    {
      filename: "MOVIE_t99.mkv",
      durationSeconds: 45,
    },
    {
      filename: "MOVIE_t100.mkv",
      durationSeconds: 60,
    },
  ],
  candidates: [
    { name: "Image Gallery", timecode: undefined },
    { name: "Promotional Featurette", timecode: undefined },
  ],
}

// Mirrors the actual shape an NSF run on Shrek 2 (UHD Blu-ray) yields:
// 3 leftover files paired against a candidate pool that includes both
// timed extras (featurettes / music videos rejected as out of
// tolerance) and untimed entries (audio commentaries, photo gallery,
// jukebox). Use this story to test the styled RenameTargetPicker
// without a real DVDCompare scrape or job run.
const shrek2BluRayPayload: SmartMatchModalState = {
  jobId: "job-shrek2",
  stepId: "step-1",
  sourcePath: "G:\\Disc-Rips\\Shrek 2 - 4K",
  unrenamedFiles: [
    {
      filename: "Shrek 2-SF_01_SpotlightPussInBoots_t46",
      durationSeconds: 643,
    },
    {
      filename: "Shrek 2-SF_04_MV_01_Accidentally_t49",
      durationSeconds: 188,
    },
    {
      filename: "Shrek 2-SF_03_FarAwayIdol_t48",
      durationSeconds: 536,
    },
  ],
  candidates: [
    {
      name: "Spotlight on Puss in Boots Featurette",
      timecode: "10:46",
    },
    {
      name: "Far Far Away Idol",
      timecode: "5:53",
    },
    {
      name: "Shrek, Rattle & Roll",
    },
    {
      name: "Accidentally in Love Music Video by Counting Crows",
      timecode: "3:22",
      parentName: "Shrek, Rattle & Roll",
    },
    {
      name: "These Boots Are Made for Walking Music Video by Puss in Boots",
      timecode: "2:17",
      parentName: "Shrek, Rattle & Roll",
    },
    {
      name: 'Shrek the Musical "I Know It\'s Today"',
      timecode: "5:36",
      parentName: "Shrek, Rattle & Roll",
    },
    {
      name: '"Shrek\'s Interactive Journey: II" Photo Gallery',
    },
    {
      name: "DreamWorks Animation Jukebox: Kung Fu Panda 2, Megamind, The Penguins of Madagascar, Shrek the Musical, and Kung Fu Panda World (video game)",
    },
    {
      name: "Audio Commentary by Directors Kelly Asbury and Conrad Vernon",
    },
    {
      name: "Audio Commentary by Producer Aron Warner and Editor Mike Andrews",
    },
    { name: "* The Film" },
  ],
}

const emptyPayload: SmartMatchModalState = {
  jobId: "job-empty",
  stepId: "step-1",
  sourcePath: "/movies/Demo",
  unrenamedFiles: [],
  candidates: [],
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

// Real-world disc shape (Shrek 2 UHD Blu-ray). The pool mixes timed
// candidates (Spotlight on Puss in Boots at 10:46, Far Far Away Idol
// at 5:53, Accidentally in Love at 3:22) with untimed entries (audio
// commentaries, photo gallery, jukebox, * The Film). Best story for
// validating the styled RenameTargetPicker's two-row option layout —
// each candidate's optional timecode chip is visible alongside the
// confidence chip, ranked by duration proximity to the file's
// runtime.
export const Shrek2BluRayDiscShape: Story = {
  parameters: { initialState: shrek2BluRayPayload },
  render: () => (
    <>
      <ReOpenButton initialState={shrek2BluRayPayload} />
      <SmartMatchModal />
    </>
  ),
}
