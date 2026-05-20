import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useState } from "react"
import { AudioPreviewModal } from "./AudioPreviewModal"
import {
  type AudioPreviewState,
  audioPreviewModalAtom,
} from "./audioPreviewModalAtom"

const ReOpenButton = ({
  initialState,
}: {
  initialState: AudioPreviewState
}) => {
  const setAudioPreview = useSetAtom(audioPreviewModalAtom)
  return (
    <div className="p-4">
      <button
        type="button"
        className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded"
        onClick={() => setAudioPreview(initialState)}
      >
        Re-open audio preview
      </button>
    </div>
  )
}

const meta: Meta<typeof AudioPreviewModal> = {
  title: "Modals/AudioPreviewModal",
  component: AudioPreviewModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as AudioPreviewState
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(audioPreviewModalAtom, initialState)
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
    initialState: {
      path: "/music/01 Primal Planet.flac",
    } satisfies AudioPreviewState,
  },
}
export default meta

type Story = StoryObj<typeof AudioPreviewModal>

export const Default: Story = {
  render: () => (
    <>
      <ReOpenButton
        initialState={{
          path: "/music/01 Primal Planet.flac",
        }}
      />
      <AudioPreviewModal />
    </>
  ),
}
