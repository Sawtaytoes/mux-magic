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
  // ─── Existing single-rule tests (regression) ─────────────────────────────

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

  test("typing flags promotes the wire shape to the 4-key object", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: {
        renameRegex: { pattern: "foo", replacement: "bar" },
      },
    })
    await user.type(screen.getByLabelText("Flags"), "i")
    const updated = store.get(stepsAtom)[0] as Step
    expect(updated.params.renameRegex).toEqual({
      pattern: "foo",
      replacement: "bar",
      flags: "i",
    })
  })

  test("sample-driven live preview renders Match badge + predicted output + captured groups", async () => {
    const user = userEvent.setup()
    renderField({
      ...baseStep,
      params: {
        renameRegex: {
          pattern: "^(.+)-(\\d+)\\.mkv$",
          replacement: "$1 ep$2.mkv",
        },
      },
    })
    await user.type(
      screen.getByLabelText("Test against (optional)"),
      "show-01.mkv",
    )
    expect(screen.getByText("Match")).toBeVisible()
    expect(screen.getByText("show ep01.mkv")).toBeVisible()
    // Numeric capture groups echo back inline
    expect(screen.getByText(/"show"/)).toBeVisible()
    expect(screen.getByText(/"01"/)).toBeVisible()
  })

  test("non-matching sample renders the No match badge", async () => {
    const user = userEvent.setup()
    renderField({
      ...baseStep,
      params: {
        renameRegex: {
          pattern: "^foo$",
          replacement: "bar",
        },
      },
    })
    await user.type(
      screen.getByLabelText("Test against (optional)"),
      "baz",
    )
    expect(screen.getByText("No match")).toBeVisible()
  })

  test("slash-form toggle flips display without changing the underlying value", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: {
        renameRegex: {
          pattern: "foo",
          replacement: "bar",
          flags: "i",
        },
      },
    })
    await user.click(
      screen.getByRole("button", {
        name: /toggle slash-form/i,
      }),
    )
    const slashInput = screen.getByLabelText(
      "Pattern + flags",
    ) as HTMLInputElement
    expect(slashInput.value).toBe("/foo/i")
    const updated = store.get(stepsAtom)[0] as Step
    expect(updated.params.renameRegex).toEqual({
      pattern: "foo",
      replacement: "bar",
      flags: "i",
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

  // ─── Array form — initial read ────────────────────────────────────────────

  test("renders rule rows when value is an array of rules", () => {
    renderField({
      ...baseStep,
      params: {
        renameRegex: [
          {
            pattern: "^Dandadan",
            replacement: "Dan Da Dan",
          },
          {
            pattern: "(Centuria) (\\d+)",
            replacement: "$1 c$2",
          },
        ],
      },
    })
    const patternInputs = screen.getAllByLabelText(
      "Pattern",
    ) as HTMLInputElement[]
    expect(patternInputs).toHaveLength(2)
    expect(patternInputs[0].value).toBe("^Dandadan")
    expect(patternInputs[1].value).toBe("(Centuria) (\\d+)")
  })

  // ─── Add rule ─────────────────────────────────────────────────────────────

  test("clicking Add rule converts to array form and appends a blank rule", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: {
        renameRegex: {
          pattern: "^Dandadan",
          replacement: "Dan Da Dan",
        },
      },
    })
    await user.click(
      screen.getByRole("button", { name: /add rule/i }),
    )
    const updated = store.get(stepsAtom)[0] as Step
    expect(Array.isArray(updated.params.renameRegex)).toBe(
      true,
    )
    const rules = updated.params.renameRegex as Array<{
      pattern: string
      replacement: string
    }>
    expect(rules).toHaveLength(2)
    expect(rules[0].pattern).toBe("^Dandadan")
    expect(rules[1].pattern).toBe("")
  })

  test("add rule on empty field appends a second blank row", async () => {
    const user = userEvent.setup()
    const store = renderField()
    await user.click(
      screen.getByRole("button", { name: /add rule/i }),
    )
    const updated = store.get(stepsAtom)[0] as Step
    expect(Array.isArray(updated.params.renameRegex)).toBe(
      true,
    )
    const rules = updated.params.renameRegex as Array<{
      pattern: string
      replacement: string
    }>
    expect(rules).toHaveLength(2)
  })

  // ─── Delete rule ──────────────────────────────────────────────────────────

  test("deleting a rule in chain mode removes the row", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: {
        renameRegex: [
          { pattern: "rule1", replacement: "r1" },
          { pattern: "rule2", replacement: "r2" },
          { pattern: "rule3", replacement: "r3" },
        ],
      },
    })
    const deleteButtons = screen.getAllByRole("button", {
      name: /delete rule/i,
    })
    expect(deleteButtons).toHaveLength(3)
    await user.click(deleteButtons[1])
    const updated = store.get(stepsAtom)[0] as Step
    const rules = updated.params.renameRegex as Array<{
      pattern: string
      replacement: string
    }>
    expect(rules).toHaveLength(2)
    expect(rules[0].pattern).toBe("rule1")
    expect(rules[1].pattern).toBe("rule3")
  })

  test("deleting down to one rule keeps the array form", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: {
        renameRegex: [
          { pattern: "rule1", replacement: "r1" },
          { pattern: "rule2", replacement: "r2" },
        ],
      },
    })
    const deleteButtons = screen.getAllByRole("button", {
      name: /delete rule/i,
    })
    await user.click(deleteButtons[1])
    const updated = store.get(stepsAtom)[0] as Step
    expect(Array.isArray(updated.params.renameRegex)).toBe(
      true,
    )
    const rules = updated.params.renameRegex as Array<{
      pattern: string
    }>
    expect(rules).toHaveLength(1)
    expect(rules[0].pattern).toBe("rule1")
  })

  // ─── Reorder ──────────────────────────────────────────────────────────────

  test("move-up swaps a rule with the one above it", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: {
        renameRegex: [
          { pattern: "first", replacement: "F" },
          { pattern: "second", replacement: "S" },
        ],
      },
    })
    const upButtons = screen.getAllByRole("button", {
      name: /move rule up/i,
    })
    await user.click(upButtons[1])
    const updated = store.get(stepsAtom)[0] as Step
    const rules = updated.params.renameRegex as Array<{
      pattern: string
    }>
    expect(rules[0].pattern).toBe("second")
    expect(rules[1].pattern).toBe("first")
  })

  test("move-down swaps a rule with the one below it", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: {
        renameRegex: [
          { pattern: "first", replacement: "F" },
          { pattern: "second", replacement: "S" },
        ],
      },
    })
    const downButtons = screen.getAllByRole("button", {
      name: /move rule down/i,
    })
    await user.click(downButtons[0])
    const updated = store.get(stepsAtom)[0] as Step
    const rules = updated.params.renameRegex as Array<{
      pattern: string
    }>
    expect(rules[0].pattern).toBe("second")
    expect(rules[1].pattern).toBe("first")
  })

  // ─── Chain final-output preview ───────────────────────────────────────────

  test("final-output preview reflects chain output when first rule has a sample", async () => {
    renderField({
      ...baseStep,
      params: {
        renameRegex: [
          {
            pattern: "^Dandadan",
            replacement: "Dan Da Dan",
            sample: "Dandadan Vol 1",
          },
          {
            pattern: "Dan Da Dan",
            replacement: "DDD",
          },
        ],
      },
    })
    expect(screen.getByText("Chain output")).toBeVisible()
    expect(screen.getByText("DDD Vol 1")).toBeVisible()
  })
})
