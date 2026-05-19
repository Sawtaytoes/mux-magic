import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { SubtitleTypesField } from "./SubtitleTypesField"

const meta = {
  title: "Fields/SubtitleTypesField",
  component: SubtitleTypesField,
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
} satisfies Meta<typeof SubtitleTypesField>

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

const field = {
  name: "subtitleTypes",
  type: "subtitleTypes",
  label: "Subtitle Types",
}

export const Empty: Story = {
  args: { step: mockStep(), field },
}

export const OneTag: Story = {
  args: {
    step: mockStep({ params: { subtitleTypes: ["ass"] } }),
    field,
  },
}

export const ManyTags: Story = {
  args: {
    step: mockStep({
      params: { subtitleTypes: ["ass", "srt", "sup"] },
    }),
    field,
  },
}
