import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { FIXTURE_COMMANDS_BUNDLE_E } from "../../commands/__fixtures__/commands"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { FolderTagsField } from "./FolderTagsField"

const meta = {
  title: "Fields/FolderTagsField",
  component: FolderTagsField,
  decorators: [
    (Story, context) => {
      const store = createStore()
      const step = context.args.step as Step
      store.set(stepsAtom, [step])
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      )
    },
  ],
} satisfies Meta<typeof FolderTagsField>

export default meta
type Story = StoryObj<typeof meta>

const mockStep = (overrides?: Partial<Step>): Step => ({
  id: "step-1",
  alias: "",
  command: "extractSubtitles",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const field =
  FIXTURE_COMMANDS_BUNDLE_E.extractSubtitles.fields[1]

export const Empty: Story = {
  args: { step: mockStep(), field },
}

export const OneTag: Story = {
  args: {
    step: mockStep({ params: { folders: ["Subs"] } }),
    field,
  },
}

export const ManyTags: Story = {
  args: {
    step: mockStep({
      params: {
        folders: ["Subs", "Subtitles", "Captions"],
      },
    }),
    field,
  },
}
