import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { useState } from "react"
import { promptModalAtom } from "../../state/uiAtoms"
import type { PromptData } from "../../types"
import { PromptModal } from "./PromptModal"

const meta: Meta<typeof PromptModal> = {
  title: "Components/PromptModal",
  component: PromptModal,
  decorators: [
    (Story, context) => {
      const initialState = context.parameters
        .initialState as PromptData
      const [store] = useState(() => {
        const newStore = createStore()
        newStore.set(promptModalAtom, initialState)
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
      jobId: "job-demo",
      promptId: "prompt-demo",
      message:
        "Multiple files matched — which one should be used for the artwork extraction?",
      options: [
        { index: 1, label: "Movie.2023.BluRay.mkv" },
        { index: 2, label: "Movie.2023.WEB-DL.mkv" },
        { index: -1, label: "Skip this step" },
      ],
    } satisfies PromptData,
  },
}
export default meta

type Story = StoryObj<typeof PromptModal>

export const Default: Story = {}

export const WithPerRowPlayButtons: Story = {
  parameters: {
    initialState: {
      jobId: "job-fp",
      promptId: "prompt-fp",
      message: "Pick the best source file:",
      filePaths: [
        { index: 1, path: "/movies/Movie.mkv" },
        { index: 2, path: "/movies/Movie-extras.mkv" },
      ],
      options: [
        { index: 1, label: "Main feature" },
        { index: 2, label: "Extras disc" },
        { index: -1, label: "Skip" },
      ],
    } satisfies PromptData,
  },
}
