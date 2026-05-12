import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { pathPickerStateAtom } from "../../state/pickerAtoms"
import { PathPicker } from "./PathPicker"

const TRIGGER_RECT = {
  left: 200,
  top: 300,
  right: 580,
  bottom: 324,
  width: 380,
  height: 24,
}

const makeMockInput = (value = "/home/user/") => {
  if (typeof document === "undefined") return null
  const input = document.createElement("input")
  input.value = value
  return input
}

const withLoadedEntries = () => {
  const store = createStore()
  const input = makeMockInput()
  if (input) {
    store.set(pathPickerStateAtom, {
      inputElement: input,
      target: {
        mode: "step",
        stepId: "step-1",
        fieldName: "sourcePath",
      },
      parentPath: "/home/user",
      query: "",
      triggerRect: TRIGGER_RECT,
      entries: [
        { name: "Documents", isDirectory: true },
        { name: "Downloads", isDirectory: true },
        { name: "Music", isDirectory: true },
        { name: "Pictures", isDirectory: true },
        { name: "Videos", isDirectory: true },
      ],
      error: null,
      activeIndex: 1,
      matches: [
        { name: "Documents", isDirectory: true },
        { name: "Downloads", isDirectory: true },
        { name: "Music", isDirectory: true },
        { name: "Pictures", isDirectory: true },
        { name: "Videos", isDirectory: true },
      ],
      separator: "/",
      cachedParentPath: "/home/user",
      requestToken: 1,
      debounceTimerId: null,
    })
  }
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const withLoadingState = () => {
  const store = createStore()
  const input = makeMockInput()
  if (input) {
    store.set(pathPickerStateAtom, {
      inputElement: input,
      target: {
        mode: "step",
        stepId: "step-1",
        fieldName: "sourcePath",
      },
      parentPath: "/home/user",
      query: "",
      triggerRect: TRIGGER_RECT,
      entries: null,
      error: null,
      activeIndex: 0,
      matches: null,
      separator: "/",
      cachedParentPath: null,
      requestToken: 0,
      debounceTimerId: null,
    })
  }
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const withErrorState = () => {
  const store = createStore()
  const input = makeMockInput("/nonexistent/")
  if (input) {
    store.set(pathPickerStateAtom, {
      inputElement: input,
      target: {
        mode: "step",
        stepId: "step-1",
        fieldName: "sourcePath",
      },
      parentPath: "/nonexistent",
      query: "",
      triggerRect: TRIGGER_RECT,
      entries: [],
      error: "Directory not found: /nonexistent",
      activeIndex: 0,
      matches: [],
      separator: "/",
      cachedParentPath: null,
      requestToken: 1,
      debounceTimerId: null,
    })
  }
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof PathPicker> = {
  title: "Pickers/PathPicker",
  component: PathPicker,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof PathPicker>

export const WithEntries: Story = {
  decorators: [withLoadedEntries()],
}

export const Loading: Story = {
  decorators: [withLoadingState()],
}

export const WithError: Story = {
  decorators: [withErrorState()],
}
