import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it } from "vitest"
import { FIXTURE_COMMANDS_BUNDLE_C } from "../../commands/__fixtures__/commands"
import { stepsAtom } from "../../state/stepsAtom"
import type { CommandField, Step } from "../../types"
import { StringArrayField } from "./StringArrayField"

const renderField = (step: Step, field: CommandField) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <StringArrayField field={field} step={step} />
    </Provider>,
  )
}

afterEach(() => {
  cleanup()
})

describe("StringArrayField", () => {
  const field: CommandField = FIXTURE_COMMANDS_BUNDLE_C
    .deleteFilesByExtension.fields[1] as CommandField

  it("displays empty string when value is undefined", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "deleteFilesByExtension",
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
      command: "deleteFilesByExtension",
      params: { extensions: [".srt", ".idx"] },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const input = screen.getByRole("textbox")
    expect(input).toHaveValue(".srt, .idx")
  })

  it("trims whitespace from items", () => {
    const step: Step = {
      id: "step-1",
      alias: "",
      command: "deleteFilesByExtension",
      params: { extensions: [".srt", ".idx"] },
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }

    renderField(step, field)
    const input = screen.getByRole("textbox")
    expect(input).toHaveValue(".srt, .idx")
  })

  it("uses field placeholder when provided", () => {
    const customField: CommandField = {
      ...field,
      placeholder: ".mkv, .mp4",
    }

    const step: Step = {
      id: "step-1",
      alias: "",
      command: "deleteFilesByExtension",
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
      ".mkv, .mp4",
    )
  })
})
