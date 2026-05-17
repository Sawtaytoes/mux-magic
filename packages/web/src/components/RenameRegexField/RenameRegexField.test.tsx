import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import type { CommandField } from "../../commands/types"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { RenameRegexField } from "./RenameRegexField"

const baseStep: Step = {
  id: "step1",
  alias: "",
  command: "copyFiles",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const field: CommandField = {
  name: "renameRegex",
  type: "renameRegex",
  label: "Rename Regex",
  isRequired: false,
}

const renderField = (step: Step = baseStep) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <RenameRegexField field={field} step={step} />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

describe("RenameRegexField", () => {
  test("renders blank pattern + replacement inputs when no value is set", () => {
    renderField()
    const patternInput = screen.getByLabelText(
      "Pattern",
    ) as HTMLInputElement
    const replacementInput = screen.getByLabelText(
      "Replacement",
    ) as HTMLInputElement
    expect(patternInput.value).toBe("")
    expect(replacementInput.value).toBe("")
  })

  test("renders the current pattern + replacement from params", () => {
    renderField({
      ...baseStep,
      params: {
        renameRegex: {
          pattern: "^(.+)\\.mkv$",
          replacement: "$1.mp4",
        },
      },
    })
    const patternInput = screen.getByLabelText(
      "Pattern",
    ) as HTMLInputElement
    const replacementInput = screen.getByLabelText(
      "Replacement",
    ) as HTMLInputElement
    expect(patternInput.value).toBe("^(.+)\\.mkv$")
    expect(replacementInput.value).toBe("$1.mp4")
  })

  test("typing in pattern writes the full object atomically", async () => {
    const user = userEvent.setup()
    const store = renderField()
    await user.type(screen.getByLabelText("Pattern"), "x")
    const updated = store.get(stepsAtom)[0] as Step
    expect(updated.params.renameRegex).toEqual({
      pattern: "x",
      replacement: "",
    })
  })

  test("typing in replacement writes the full object atomically", async () => {
    const user = userEvent.setup()
    const store = renderField()
    await user.type(
      screen.getByLabelText("Replacement"),
      "y",
    )
    const updated = store.get(stepsAtom)[0] as Step
    expect(updated.params.renameRegex).toEqual({
      pattern: "",
      replacement: "y",
    })
  })

  test("clearing both fields writes undefined so buildParams omits the key", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: {
        renameRegex: { pattern: "a", replacement: "b" },
      },
    })
    const patternInput = screen.getByLabelText("Pattern")
    const replacementInput =
      screen.getByLabelText("Replacement")
    await user.clear(patternInput)
    await user.clear(replacementInput)
    const updated = store.get(stepsAtom)[0] as Step
    expect(updated.params.renameRegex).toBeUndefined()
  })
})
