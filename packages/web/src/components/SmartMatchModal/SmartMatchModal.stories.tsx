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
