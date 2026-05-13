import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import {
  afterEach,
  describe,
  expect,
  it,
  test,
  vi,
} from "vitest"
import type { CommandField } from "../../commands/types"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { JsonField } from "./JsonField"

const renderField = (step: Step, field: CommandField) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <JsonField field={field} step={step} />
    </Provider>,
  )
}

afterEach(() => {
  cleanup()
})

describe("JsonField", () => {
  const field: CommandField = {
    name: "testJson",
    type: "json",
    label: "JSON Data",
  }

  it("displays empty string when value is undefined", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveValue("")
  })

  it("displays string value as-is", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: { testJson: '{"key": "value"}' },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveValue('{"key": "value"}')
  })

  it("displays object value as formatted JSON", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: {
        testJson: { key: "value", nested: { foo: "bar" } },
      },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveValue(
      JSON.stringify(
        { key: "value", nested: { foo: "bar" } },
        null,
        2,
      ),
    )
  })

  it("handles empty JSON object", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: { testJson: {} },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveValue("{}")
  })

  it("handles arrays in JSON", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: { testJson: [1, 2, 3] },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveValue("[\n  1,\n  2,\n  3\n]")
  })

  it("displays linked state as read-only text", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: { testJson: {} },
      links: {
        testJson: {
          linkedTo: "step-0",
          output: "outputFolder",
        },
      },
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    expect(
      screen.queryByRole("textbox"),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("Linked → step-0.outputFolder"),
    ).toBeInTheDocument()
  })

  it("displays linked state with default output name", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: { testJson: {} },
      links: {
        testJson: {
          linkedTo: "step-0",
          output: "folder",
        },
      },
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    expect(
      screen.getByText("Linked → step-0.folder"),
    ).toBeInTheDocument()
  })

  it("uses field placeholder when provided", () => {
    const customField: CommandField = {
      ...field,
      placeholder: '{"default": "value"}',
    }

    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, customField)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveAttribute(
      "placeholder",
      '{"default": "value"}',
    )
  })

  it("defaults to [] placeholder", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveAttribute("placeholder", "[]")
  })

  it("has id matching command-fieldName for label association", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveAttribute(
      "id",
      "testCommand-testJson",
    )
  })

  it("sets aria-required when field is required", () => {
    const requiredField: CommandField = {
      ...field,
      isRequired: true,
    }
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, requiredField)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveAttribute(
      "aria-required",
      "true",
    )
  })

  it("does not set aria-required when field is not required", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const textarea = screen.getByRole("textbox")
    expect(textarea).not.toHaveAttribute("aria-required")
  })

  test("isReadOnly suppresses onChange — textarea has readOnly attribute", async () => {
    const user = userEvent.setup()
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "testCommand",
      params: { testJson: '{"key": "value"}' },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }
    const store = createStore()
    store.set(stepsAtom, [step])
    render(
      <Provider store={store}>
        <JsonField
          field={field}
          step={step}
          isReadOnly={true}
        />
      </Provider>,
    )
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveAttribute("readonly")
    const valueBefore =
      textarea.getAttribute("value") ??
      (textarea as HTMLTextAreaElement).value
    await user.type(textarea, "extra")
    expect((textarea as HTMLTextAreaElement).value).toBe(
      valueBefore,
    )
  })
})
