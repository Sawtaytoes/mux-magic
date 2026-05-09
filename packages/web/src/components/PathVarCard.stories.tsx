import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { pathsAtom } from "../state/pathsAtom"
import type { PathVar } from "../types"
import { PathVarCard } from "./PathVarCard"

const basePath: PathVar = {
  id: "basePath",
  label: "Base Path",
  value: "/mnt/media",
}

const withStore = (paths: PathVar[]) => {
  const store = createStore()
  store.set(pathsAtom, paths)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <Story />
    </Provider>
  )
}

const meta: Meta<typeof PathVarCard> = {
  title: "Components/PathVarCard",
  component: PathVarCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof PathVarCard>

export const BasePath: Story = {
  decorators: [withStore([basePath])],
  args: { pathVar: basePath, isFirst: true },
}

export const SecondaryPath: Story = {
  decorators: [
    withStore([basePath, { id: "outputPath", label: "Output Path", value: "/mnt/output" }]),
  ],
  args: {
    pathVar: { id: "outputPath", label: "Output Path", value: "/mnt/output" },
    isFirst: false,
  },
}

export const EmptyValue: Story = {
  decorators: [withStore([{ ...basePath, value: "" }])],
  args: { pathVar: { ...basePath, value: "" }, isFirst: false },
}
