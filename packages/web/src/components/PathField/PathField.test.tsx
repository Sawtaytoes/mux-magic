import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider, useAtomValue } from "jotai"
import { describe, expect, test } from "vitest"

import { FIXTURE_COMMANDS_BUNDLE_D } from "../../commands/__fixtures__/commands"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { PathField } from "./PathField"

const createTestStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "test-step-1",
  alias: "",
  command: "makeDirectory",
  params: { sourcePath: "/test/path" },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

// Reads step from the atom so controlled inputs update after each onChange call.
// Required for unlinked PathField tests where displayValue derives from the step
// prop, not the atom — without this, the controlled input reverts to the prop
// value after every keystroke, making user.type incompatible.
const TestPathFieldFromAtom = ({
  stepId,
}: {
  stepId: string
}) => {
  const allSteps = useAtomValue(stepsAtom)
  const step = allSteps.find(
    (item) => "id" in item && item.id === stepId,
  ) as Step
  return (
    <PathField
      field={
        FIXTURE_COMMANDS_BUNDLE_D.makeDirectory.fields[0]
      }
      step={step}
    />
  )
}

describe("PathField", () => {
  const field =
    FIXTURE_COMMANDS_BUNDLE_D.makeDirectory.fields[0]

  test("renders input with current value", () => {
    const step = createTestStep({
      params: { sourcePath: "/home/user" },
    })
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    const input = screen.getByDisplayValue("/home/user")
    expect(input).toBeInTheDocument()
  })

  test("shows browse button", () => {
    const step = createTestStep()
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    const browseButton = screen.getByTitle(/browse/i)
    expect(browseButton).toBeInTheDocument()
  })

  test("shows link button with custom label when no link", () => {
    const step = createTestStep()
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    expect(
      screen.getByText("— custom —"),
    ).toBeInTheDocument()
  })

  test("shows link button with path var label when linked to path var", () => {
    const step = createTestStep({
      links: { sourcePath: "basePath" },
    })
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    const button = screen.getByRole("button", {
      name: /basePath/i,
    })
    expect(button).toBeInTheDocument()
  })

  test("makes input readonly when linked to step output", () => {
    const step = createTestStep({
      links: {
        sourcePath: {
          linkedTo: "step-1",
          output: "folder",
        },
      },
    })
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    const input = screen.getByRole("textbox")
    expect(input).toHaveAttribute("readonly")
  })

  test("typing into linked PathField updates path variable value, not step param", async () => {
    const user = userEvent.setup({ delay: null })
    const store = createStore()
    store.set(pathsAtom, [
      {
        id: "basePath",
        label: "basePath",
        value: "/old/path",
        type: "path" as const,
      },
    ])
    store.set(stepsAtom, [
      createTestStep({
        links: { sourcePath: "basePath" },
        params: {},
      }),
    ])

    const step = createTestStep({
      links: { sourcePath: "basePath" },
      params: {},
    })
    render(
      <Provider store={store}>
        <PathField field={field} step={step} />
      </Provider>,
    )

    const input = screen.getByRole("textbox")
    await user.clear(input)
    await user.type(input, "/new/path")

    const updatedPaths = store.get(pathsAtom)
    expect(updatedPaths[0].value).toBe("/new/path")

    const updatedSteps = store.get(stepsAtom)
    const updatedStep = updatedSteps[0] as Step
    expect(updatedStep.params.sourcePath).toBeUndefined()
  })

  test("typing into unlinked PathField with no existing param creates path var and links field", async () => {
    const user = userEvent.setup({ delay: null })
    const store = createStore()
    store.set(pathsAtom, [])
    store.set(stepsAtom, [
      createTestStep({ params: {}, links: {} }),
    ])

    render(
      <Provider store={store}>
        <TestPathFieldFromAtom stepId="test-step-1" />
      </Provider>,
    )

    const input = screen.getByRole("textbox")
    await user.type(input, "/new/path")

    const updatedPaths = store.get(pathsAtom)
    expect(updatedPaths).toHaveLength(1)
    expect(updatedPaths[0].value).toBe("/new/path")

    const updatedSteps = store.get(stepsAtom)
    const updatedStep = updatedSteps[0] as Step
    const linkedId = updatedStep.links?.sourcePath
    expect(typeof linkedId).toBe("string")
    expect(linkedId).toBe(updatedPaths[0].id)
  })

  test("typing into unlinked PathField with existing param value updates param (not addPathVariable)", async () => {
    const user = userEvent.setup({ delay: null })
    const store = createStore()
    store.set(stepsAtom, [
      createTestStep({
        params: { sourcePath: "/existing" },
        links: {},
      }),
    ])

    render(
      <Provider store={store}>
        <TestPathFieldFromAtom stepId="test-step-1" />
      </Provider>,
    )

    const input = screen.getByRole("textbox")
    await user.type(input, "/extra")

    const updatedSteps = store.get(stepsAtom)
    const updatedStep = updatedSteps[0] as Step
    expect(updatedStep.params.sourcePath).toBe(
      "/existing/extra",
    )

    const updatedPaths = store.get(pathsAtom)
    expect(updatedPaths).toHaveLength(0)
  })

  test("typing in linked PathField syncs value to other fields linked to same variable", async () => {
    const user = userEvent.setup({ delay: null })
    const store = createStore()
    const basePathVariable = {
      id: "basePath",
      label: "basePath",
      value: "/old",
      type: "path" as const,
    }
    const step1 = createTestStep({
      id: "step-1",
      links: { sourcePath: "basePath" },
      params: {},
    })
    const step2 = createTestStep({
      id: "step-2",
      links: { sourcePath: "basePath" },
      params: {},
    })

    store.set(pathsAtom, [basePathVariable])
    store.set(stepsAtom, [step1, step2])

    render(
      <Provider store={store}>
        <PathField field={field} step={step1} />
        <PathField field={field} step={step2} />
      </Provider>,
    )

    const inputs = screen.getAllByRole("textbox")
    await user.clear(inputs[0])
    await user.type(inputs[0], "/new")

    const updatedPaths = store.get(pathsAtom)
    expect(updatedPaths[0].value).toBe("/new")
    expect(inputs[0]).toHaveValue("/new")
    expect(inputs[1]).toHaveValue("/new")
  })
})
