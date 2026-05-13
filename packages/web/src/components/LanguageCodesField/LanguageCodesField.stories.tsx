import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider } from "jotai"
import { FIXTURE_COMMANDS_BUNDLE_B } from "../../commands/__fixtures__/commands"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { LanguageCodesField } from "./LanguageCodesField"

const meta = {
  title: "Fields/LanguageCodesField",
  component: LanguageCodesField,
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
} satisfies Meta<typeof LanguageCodesField>

export default meta
type Story = StoryObj<typeof meta>

const mockStep = (overrides?: Partial<Step>): Step => ({
  id: "step-1",
  alias: "",
  command: "keepLanguages",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const field =
  FIXTURE_COMMANDS_BUNDLE_B.keepLanguages.fields[1]

export const Empty: Story = {
  args: { step: mockStep(), field },
}

export const OneTag: Story = {
  args: {
    step: mockStep({ params: { audioLanguages: ["eng"] } }),
    field,
  },
}

export const ManyTags: Story = {
  args: {
    step: mockStep({
      params: {
        audioLanguages: ["eng", "jpn", "spa", "fra"],
      },
    }),
    field,
  },
}
