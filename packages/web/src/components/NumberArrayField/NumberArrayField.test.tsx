import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  it,
  test,
} from "vitest"
import { FIXTURE_COMMANDS_BUNDLE_C } from "../../commands/__fixtures__/commands"
import type { CommandField } from "../../commands/types"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { NumberArrayField } from "./NumberArrayField"

const makeStep = (
  params: Record<string, unknown> = {},
): Step => ({
  id: "step-1",
  alias: "",
  command: "addSubtitles",
  params,
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

const renderField = (step: Step, field: CommandField) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <NumberArrayField field={field} step={step} />
    </Provider>,
  )
}

const renderFieldWithStore = (
  step: Step,
  field: CommandField,
) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <NumberArrayField field={field} step={step} />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

describe("NumberArrayField", () => {
  const field: CommandField = FIXTURE_COMMANDS_BUNDLE_C
    .addSubtitles.fields[1] as CommandField

  it("displays empty string when value is undefined", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "addSubtitles",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const input = screen.getByRole("textbox")
    expect(input).toHaveValue("")
  })

  it("displays array as comma-separated string", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "addSubtitles",
      params: { offsets: [0, -200, 150] },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const input = screen.getByRole("textbox")
    expect(input).toHaveValue("0, -200, 150")
  })

  it("trims whitespace from items", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "addSubtitles",
      params: { offsets: [100, -50] },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const input = screen.getByRole("textbox")
    expect(input).toHaveValue("100, -50")
  })

  it("filters out non-numeric values", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "addSubtitles",
      params: { offsets: [100, 50] },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const input = screen.getByRole("textbox")
    expect(input).toHaveValue("100, 50")
  })

  it("uses field placeholder when provided", () => {
    const customField: CommandField = {
      ...field,
      placeholder: "100, 200, 300",
    }

    const step: Step = {
      id: "step-1",
      alias: "",
      command: "addSubtitles",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, customField)
    const input = screen.getByRole("textbox")
    expect(input).toHaveAttribute(
      "placeholder",
      "100, 200, 300",
    )
  })

  it("defaults to showing 0, 100 placeholder", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "addSubtitles",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    const fieldWithoutPlaceholder: CommandField = {
      name: "offsets",
      type: "numberArray",
      label: "Offsets",
    }

    renderField(step, fieldWithoutPlaceholder)
    const input = screen.getByRole("textbox")
    expect(input).toHaveAttribute("placeholder", "0, 100")
  })

  test("preserves raw text while typing — does not parse on change", () => {
    const step = makeStep()
    renderField(step, field)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, {
      target: { value: "1 2 abc 3" },
    })
    expect(input).toHaveValue("1 2 abc 3")
  })

  test("parses comma-separated numbers into array on blur", () => {
    const step = makeStep()
    const store = renderFieldWithStore(step, field)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, {
      target: { value: "10, 20, 30" },
    })
    fireEvent.blur(input)
    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.offsets).toEqual([
      10, 20, 30,
    ])
  })

  test("parses whitespace-separated numbers into array on blur", () => {
    const step = makeStep()
    const store = renderFieldWithStore(step, field)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, {
      target: { value: "10 20 30" },
    })
    fireEvent.blur(input)
    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.offsets).toEqual([
      10, 20, 30,
    ])
  })

  test("ignores non-numeric tokens on blur — valid numbers still saved", () => {
    const step = makeStep()
    const store = renderFieldWithStore(step, field)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, {
      target: { value: "5 abc 10" },
    })
    fireEvent.blur(input)
    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.offsets).toEqual([
      5, 10,
    ])
  })
})
