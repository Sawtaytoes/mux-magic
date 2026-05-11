import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { stepsAtom } from "../../state/stepsAtom"
import type { Group, Step } from "../../types"
import { GroupCard } from "./GroupCard"

const makeStep = (id: string, command = ""): Step => ({
  id,
  alias: "",
  command,
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

const serialGroup: Group = {
  kind: "group",
  id: "group_1",
  label: "Encode batch",
  isParallel: false,
  isCollapsed: false,
  steps: [
    makeStep("step_1", "encodeVideo"),
    makeStep("step_2", "moveFile"),
  ],
}

const parallelGroup: Group = {
  kind: "group",
  id: "group_2",
  label: "Parallel downloads",
  isParallel: true,
  isCollapsed: false,
  steps: [
    makeStep("step_3", "downloadEpisodes"),
    makeStep("step_4", "downloadEpisodes"),
  ],
}

const withStore = (group: Group) => {
  const store = createStore()
  store.set(stepsAtom, [group])
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof GroupCard> = {
  title: "Components/GroupCard",
  component: GroupCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof GroupCard>

export const Sequential: Story = {
  decorators: [withStore(serialGroup)],
  args: {
    group: serialGroup,
    itemIndex: 0,
    startingFlatIndex: 0,
    isFirst: true,
    isLast: true,
  },
}

export const Parallel: Story = {
  decorators: [withStore(parallelGroup)],
  args: {
    group: parallelGroup,
    itemIndex: 0,
    startingFlatIndex: 0,
    isFirst: true,
    isLast: true,
  },
}

export const Collapsed: Story = {
  decorators: [
    withStore({ ...serialGroup, isCollapsed: true }),
  ],
  args: {
    group: { ...serialGroup, isCollapsed: true },
    itemIndex: 0,
    startingFlatIndex: 0,
    isFirst: true,
    isLast: true,
  },
}

const singleStepGroup: Group = {
  kind: "group",
  id: "group_3",
  label: "",
  isParallel: false,
  isCollapsed: false,
  steps: [makeStep("step_5")],
}

export const SingleStep: Story = {
  decorators: [withStore(singleStepGroup)],
  args: {
    group: singleStepGroup,
    itemIndex: 0,
    startingFlatIndex: 0,
    isFirst: true,
    isLast: true,
  },
}
