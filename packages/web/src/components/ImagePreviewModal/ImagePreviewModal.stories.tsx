import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useSetAtom } from "jotai"
import { useState } from "react"
import { ImagePreviewModal } from "./ImagePreviewModal"
import {
  type ImagePreviewState,
  imagePreviewModalAtom,
} from "./imagePreviewModalAtom"

const ReOpenButton = ({
  initialState,
}: {
  initialState: ImagePreviewState
}) => {
  const setImagePreview = useSetAtom(imagePreviewModalAtom)
  return (
    <div className="p-4">
      <button
        type="button"
        className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded"
        onClick={() => setImagePreview(initialState)}
      >
        Re-open image preview
      </button>
    </div>
  )
}

const meta: Meta<typeof ImagePreviewModal> = {
  title: "Modals/ImagePreviewModal",
  component: ImagePreviewModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as ImagePreviewState
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(imagePreviewModalAtom, initialState)
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
      path: "/music/Album/cover.jpg",
    } satisfies ImagePreviewState,
  },
}
export default meta

type Story = StoryObj<typeof ImagePreviewModal>

export const Default: Story = {
  render: () => (
    <>
      <ReOpenButton
        initialState={{
          path: "/music/Album/cover.jpg",
        }}
      />
      <ImagePreviewModal />
    </>
  ),
}
