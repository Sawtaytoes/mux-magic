import type { Meta, StoryObj } from "@storybook/react"
import { createStore, Provider, useAtomValue } from "jotai"
import { useState } from "react"
import {
  expect,
  userEvent,
  waitFor,
  within,
} from "storybook/test"
import { FIXTURE_COMMANDS_BUNDLE_D } from "../../commands/__fixtures__/commands"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type {
  PathVariable,
  SequenceItem,
  Step,
} from "../../types"
import { PathField } from "./PathField"

const field =
  FIXTURE_COMMANDS_BUNDLE_D.makeDirectory.fields[0]

// PathField derives its displayed value from the `step` prop, and its
// writeback (mint path variable / setParam) goes to the jotai store — so a
// live demo has to read the step BACK from the store, or the controlled
// input reverts to a static prop on every keystroke. This mirrors
// `TestPathFieldFromAtom` in PathField.test.tsx. Directory listings come from
// the Storybook mock server (.storybook/mock-server-plugin.ts).
const LiveField = ({ stepId }: { stepId: string }) => {
  const steps = useAtomValue(stepsAtom)

  const step = steps.find(
    (item) => "id" in item && item.id === stepId,
  ) as Step

  return (
    <div className="w-[520px] p-4">
      <PathField field={field} step={step} />
    </div>
  )
}

const StoreHarness = ({
  steps,
  paths = [],
  stepId,
}: {
  steps: SequenceItem[]
  paths?: PathVariable[]
  stepId: string
}) => {
  const [store] = useState(() => {
    const created = createStore()

    created.set(stepsAtom, steps)

    created.set(pathsAtom, paths)

    return created
  })

  return (
    <Provider store={store}>
      <LiveField stepId={stepId} />
    </Provider>
  )
}

const makeStep = (overrides: Partial<Step>): Step => ({
  id: "example",
  alias: "",
  command: "makeDirectory",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const meta: Meta<typeof PathField> = {
  title: "Fields/PathField",
  component: PathField,
}

export default meta

type Story = StoryObj<typeof PathField>

/**
 * Empty field. Type an absolute path and the directory dropdown opens
 * inline below it (attached-input Combobox); picking a folder drills in and
 * the list stays open. The play function types `/media/` to reveal it.
 */
export const Default: Story = {
  render: () => (
    <StoreHarness
      stepId="example-1"
      steps={[
        makeStep({
          id: "example-1",
          params: { sourcePath: "" },
        }),
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const input = canvas.getByRole("combobox")

    await userEvent.click(input)

    await userEvent.type(input, "/media/")

    await waitFor(() => {
      expect(
        within(document.body).getByRole("option", {
          name: /Documents/,
        }),
      ).toBeInTheDocument()
    })
  },
}

export const WithValue: Story = {
  render: () => (
    <StoreHarness
      stepId="example-2"
      steps={[
        makeStep({
          id: "example-2",
          params: { sourcePath: "/home/user/videos" },
        }),
      ]}
    />
  ),
}

export const LinkedToPathVariable: Story = {
  render: () => (
    <StoreHarness
      paths={[
        {
          id: "basePath",
          label: "basePath",
          type: "path",
          value: "/mnt/media",
        },
      ]}
      stepId="example-3"
      steps={[
        makeStep({
          id: "example-3",
          links: { sourcePath: "basePath" },
        }),
      ]}
    />
  ),
}

export const LinkedToStepOutput: Story = {
  render: () => (
    <StoreHarness
      stepId="example-4"
      steps={[
        makeStep({
          id: "example-4",
          params: { sourcePath: "/fallback/path" },
          links: {
            sourcePath: {
              linkedTo: "previous-step-id",
              output: "folder",
            },
          },
        }),
      ]}
    />
  ),
}
