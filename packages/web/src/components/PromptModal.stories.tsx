import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { promptModalAtom } from "../state/uiAtoms"
import { PromptModal } from "./PromptModal"

const store = createStore()
store.set(promptModalAtom, {
  jobId: "job-demo",
  promptId: "prompt-demo",
  message:
    "Multiple files matched — which one should be used for the artwork extraction?",
  options: [
    { index: 1, label: "Movie.2023.BluRay.mkv" },
    { index: 2, label: "Movie.2023.WEB-DL.mkv" },
    { index: -1, label: "Skip this step" },
  ],
})

const meta: Meta<typeof PromptModal> = {
  title: "Components/PromptModal",
  component: PromptModal,
  decorators: [
    (Story) => (
      <Provider store={store}>
        <Story />
      </Provider>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof PromptModal>

export const Default: Story = {}

const storeWithFilePaths = createStore()
storeWithFilePaths.set(promptModalAtom, {
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
})

export const WithPerRowPlayButtons: Story = {
  decorators: [
    (Story) => (
      <Provider store={storeWithFilePaths}>
        <Story />
      </Provider>
    ),
  ],
}
