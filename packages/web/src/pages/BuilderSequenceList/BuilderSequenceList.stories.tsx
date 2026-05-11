import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { COMMANDS } from "../../commands/commands"
import { commandsAtom } from "../../state/commandsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { Group, SequenceItem, Step } from "../../types"
import { BuilderSequenceList } from "./BuilderSequenceList"

const makeStep = (
  id: string,
  command = "encodeVideo",
  isCollapsed = false,
): Step => ({
  id,
  alias: "",
  command,
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed,
})

const makeGroup = (
  id: string,
  steps: Step[],
  isParallel = false,
  label = "",
): Group => ({
  kind: "group",
  id,
  label,
  isParallel,
  isCollapsed: false,
  steps,
})

const withStore = (steps: SequenceItem[] = []) => {
  const store = createStore()
  store.set(commandsAtom, COMMANDS)
  store.set(stepsAtom, steps)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof BuilderSequenceList> = {
  title: "Pages/BuilderSequenceList",
  component: BuilderSequenceList,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof BuilderSequenceList>

export const Empty: Story = {
  decorators: [withStore()],
}

export const SequentialSteps: Story = {
  decorators: [
    withStore([
      makeStep("step_1", "encodeVideo"),
      makeStep("step_2", "moveFile"),
      makeStep("step_3", "mergeSubtitles"),
    ]),
  ],
}

export const WithSerialGroup: Story = {
  decorators: [
    withStore([
      makeStep("step_1", "encodeVideo"),
      makeStep("step_2", "moveFile"),
      makeGroup("group_1", [
        makeStep("step_3", "mergeSubtitles"),
        makeStep("step_4", "burnSubtitles"),
      ]),
    ]),
  ],
}

export const WithParallelGroup: Story = {
  decorators: [
    withStore([
      makeGroup(
        "group_1",
        [
          makeStep("step_1", "downloadEpisodes"),
          makeStep("step_2", "downloadEpisodes"),
        ],
        true,
      ),
    ]),
  ],
}

export const Mixed: Story = {
  decorators: [
    withStore([
      makeStep("step_1", "encodeVideo"),
      makeGroup("group_1", [
        makeStep("step_2", "mergeSubtitles"),
        makeStep("step_3", "burnSubtitles"),
      ]),
      makeGroup(
        "group_2",
        [
          makeStep("step_4", "downloadEpisodes"),
          makeStep("step_5", "downloadEpisodes"),
        ],
        true,
      ),
    ]),
  ],
}
