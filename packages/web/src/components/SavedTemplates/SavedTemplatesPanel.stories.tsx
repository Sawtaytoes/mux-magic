import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"

import { COMMANDS } from "../../commands/commands"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { TemplateListItem } from "../../state/templatesApi"
import { templatesAtom } from "../../state/templatesAtoms"
import { SavedTemplatesPanel } from "./SavedTemplatesPanel"

const withInjectedTemplates = (
  injected: TemplateListItem[],
) => {
  const store = createStore()
  store.set(commandsAtom, COMMANDS)
  store.set(stepsAtom, [])
  store.set(pathsAtom, [
    {
      id: "basePath",
      label: "basePath",
      value: "",
      type: "path",
    },
  ])
  store.set(templatesAtom, injected)
  return (Story: React.ComponentType) => (
    <Provider store={store}>
      <div className="bg-slate-900 p-4 w-72">
        <Story />
      </div>
    </Provider>
  )
}

const meta: Meta<typeof SavedTemplatesPanel> = {
  title: "Components/SavedTemplates/SavedTemplatesPanel",
  component: SavedTemplatesPanel,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
}

export default meta
type Story = StoryObj<typeof SavedTemplatesPanel>

export const Empty: Story = {
  decorators: [withInjectedTemplates([])],
}

export const WithRows: Story = {
  decorators: [
    withInjectedTemplates([
      {
        id: "movie-workflow",
        name: "Movie Workflow",
        description: "First pass",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "anime-flow",
        name: "Anime Flow",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]),
  ],
}
