import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useState } from "react"
import {
  type VideoPreviewState,
  videoPreviewModalAtom,
} from "../../components/VideoPreviewModal/videoPreviewModalAtom"
import { VideoPreviewModal } from "./VideoPreviewModal"

const ReOpenButton = ({
  initialState,
}: {
  initialState: VideoPreviewState
}) => {
  const setVideoPreview = useSetAtom(videoPreviewModalAtom)
  return (
    <div className="p-4">
      <button
        type="button"
        className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded"
        onClick={() => setVideoPreview(initialState)}
      >
        Re-open video preview
      </button>
    </div>
  )
}

const meta: Meta<typeof VideoPreviewModal> = {
  title: "Modals/VideoPreviewModal",
  component: VideoPreviewModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as VideoPreviewState
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(videoPreviewModalAtom, initialState)
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
      path: "/movies/Movie.2023.BluRay.mkv",
    } satisfies VideoPreviewState,
  },
}
export default meta

type Story = StoryObj<typeof VideoPreviewModal>

export const Default: Story = {
  render: () => (
    <>
      <ReOpenButton
        initialState={{
          path: "/movies/Movie.2023.BluRay.mkv",
        }}
      />
      <VideoPreviewModal />
    </>
  ),
}
