import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it } from "vitest"

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
  params: { filePath: "/test/path" },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

describe("PathField", () => {
  const field =
    FIXTURE_COMMANDS_BUNDLE_D.makeDirectory.fields[0]

  it("renders input with current value", () => {
    const step = createTestStep({
      params: { filePath: "/home/user" },
    })
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    const input = screen.getByDisplayValue("/home/user")
    expect(input).toBeInTheDocument()
  })

  it("shows browse button", () => {
    const step = createTestStep()
    render(
      <Provider>
        <PathField field={field} step={step} />
      </Provider>,
    )
    const browseButton = screen.getByTitle(/browse/i)
    expect(browseButton).toBeInTheDocument()
  })

  it("shows link button with custom label when no link", () => {
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

  it("shows link button with path var label when linked to path var", () => {
    const step = createTestStep({
      links: { filePath: "basePath" },
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

  it("makes input readonly when linked to step output", () => {
    const step = createTestStep({
      links: {
        filePath: { linkedTo: "step-1", output: "folder" },
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

  it("typing into linked PathField updates path variable value, not step param", () => {
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
        links: { filePath: "basePath" },
        params: {},
      }),
    ])

    const step = createTestStep({
      links: { filePath: "basePath" },
      params: {},
    })
    render(
      <Provider store={store}>
        <PathField field={field} step={step} />
      </Provider>,
    )

    const input = screen.getByRole("textbox")
    fireEvent.change(input, {
      target: { value: "/new/path" },
    })

    const updatedPaths = store.get(pathsAtom)
    expect(updatedPaths[0].value).toBe("/new/path")

    const updatedSteps = store.get(stepsAtom)
    const updatedStep = updatedSteps[0] as Step
    expect(updatedStep.params.filePath).toBeUndefined()
  })

  it("typing into unlinked PathField with no existing param creates path var and links field", () => {
    const store = createStore()
    store.set(pathsAtom, [])
    store.set(stepsAtom, [
      createTestStep({ params: {}, links: {} }),
    ])

    const step = createTestStep({ params: {}, links: {} })
    render(
      <Provider store={store}>
        <PathField field={field} step={step} />
      </Provider>,
    )

    const input = screen.getByRole("textbox")
    fireEvent.change(input, {
      target: { value: "/new/path" },
    })

    const updatedPaths = store.get(pathsAtom)
    expect(updatedPaths).toHaveLength(1)
    expect(updatedPaths[0].value).toBe("/new/path")

    const updatedSteps = store.get(stepsAtom)
    const updatedStep = updatedSteps[0] as Step
    const linkedId = updatedStep.links?.filePath
    expect(typeof linkedId).toBe("string")
    expect(linkedId).toBe(updatedPaths[0].id)
  })

  it("typing into unlinked PathField with existing param value updates param (not addPathVariable)", () => {
    const store = createStore()
    store.set(stepsAtom, [
      createTestStep({
        params: { filePath: "/existing" },
        links: {},
      }),
    ])

    const step = createTestStep({
      params: { filePath: "/existing" },
      links: {},
    })
    render(
      <Provider store={store}>
        <PathField field={field} step={step} />
      </Provider>,
    )

    const input = screen.getByRole("textbox")
    fireEvent.change(input, {
      target: { value: "/updated/path" },
    })

    const updatedSteps = store.get(stepsAtom)
    const updatedStep = updatedSteps[0] as Step
    expect(updatedStep.params.filePath).toBe(
      "/updated/path",
    )

    const updatedPaths = store.get(pathsAtom)
    expect(updatedPaths).toHaveLength(0)
  })

  it("typing in linked PathField syncs value to other fields linked to same variable", () => {
    const store = createStore()
    const basePathVariable = {
      id: "basePath",
      label: "basePath",
      value: "/old",
      type: "path" as const,
    }
    const step1 = createTestStep({
      id: "step-1",
      links: { filePath: "basePath" },
      params: {},
    })
    const step2 = createTestStep({
      id: "step-2",
      links: { filePath: "basePath" },
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
    fireEvent.change(inputs[0], {
      target: { value: "/new" },
    })

    const updatedPaths = store.get(pathsAtom)
    expect(updatedPaths[0].value).toBe("/new")
    expect(inputs[0]).toHaveValue("/new")
    expect(inputs[1]).toHaveValue("/new")
  })
})
