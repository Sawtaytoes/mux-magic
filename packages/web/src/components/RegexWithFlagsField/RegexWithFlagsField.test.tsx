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
import { RegexWithFlagsField } from "./RegexWithFlagsField"

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
  name: "fileFilterRegex",
  type: "regexWithFlags",
  label: "File Filter Regex",
  isRequired: false,
  placeholder: "\\.mkv$",
}

const renderField = (step: Step = baseStep) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <RegexWithFlagsField field={field} step={step} />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

describe("RegexWithFlagsField", () => {
  test("renders a legacy bare-string value as the pattern input (worker 63 back-compat)", () => {
    renderField({
      ...baseStep,
      params: { fileFilterRegex: "\\.mkv$" },
    })
    const patternInput = screen.getByLabelText(
      "Pattern",
    ) as HTMLInputElement
    expect(patternInput.value).toBe("\\.mkv$")
  })

  test("typing in pattern WITHOUT flags or sample writes the legacy bare string", async () => {
    const user = userEvent.setup()
    const store = renderField()
    await user.type(screen.getByLabelText("Pattern"), "a")
    const updated = store.get(stepsAtom)[0] as Step
    expect(updated.params.fileFilterRegex).toBe("a")
  })

  test("adding flags promotes the wire shape to the object form", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: { fileFilterRegex: "\\.mkv$" },
    })
    await user.type(screen.getByLabelText("Flags"), "i")
    const updated = store.get(stepsAtom)[0] as Step
    expect(updated.params.fileFilterRegex).toEqual({
      pattern: "\\.mkv$",
      flags: "i",
    })
  })

  test("invalid flag chars surface aria-invalid + a descriptive tooltip without throwing", async () => {
    const user = userEvent.setup()
    renderField()
    const flagsInput = screen.getByLabelText(
      "Flags",
    ) as HTMLInputElement
    await user.type(flagsInput, "iz")
    expect(flagsInput.getAttribute("aria-invalid")).toBe(
      "true",
    )
    expect(flagsInput.title).toContain("z")
  })

  test("live preview shows Match + captured groups when sample matches", async () => {
    const user = userEvent.setup()
    renderField({
      ...baseStep,
      params: {
        fileFilterRegex: {
          pattern: "^(?<group>[A-Z]+)-\\d+",
        },
      },
    })
    await user.type(
      screen.getByLabelText("Test against (optional)"),
      "EP-01.mkv",
    )
    expect(screen.getByText("Match")).toBeVisible()
    // Named group "group" + numeric group "1" both echo back "EP"
    expect(screen.getAllByText(/"EP"/)).toHaveLength(2)
    expect(
      screen.getByText("group:", { exact: false }),
    ).toBeVisible()
  })

  test("live preview shows No match when sample does not match", async () => {
    const user = userEvent.setup()
    renderField({
      ...baseStep,
      params: { fileFilterRegex: "^foo$" },
    })
    await user.type(
      screen.getByLabelText("Test against (optional)"),
      "bar",
    )
    expect(screen.getByText("No match")).toBeVisible()
  })

  test("slash-form toggle round-trips pattern + flags", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: {
        fileFilterRegex: { pattern: "foo", flags: "i" },
      },
    })
    await user.click(
      screen.getByRole("button", {
        name: /toggle slash-form/i,
      }),
    )
    expect(
      (
        screen.getByLabelText(
          "Pattern + flags",
        ) as HTMLInputElement
      ).value,
    ).toBe("/foo/i")
    const updated = store.get(stepsAtom)[0] as Step
    expect(updated.params.fileFilterRegex).toEqual({
      pattern: "foo",
      flags: "i",
    })
  })

  test("clearing everything writes undefined so buildParams omits the key", async () => {
    const user = userEvent.setup()
    const store = renderField({
      ...baseStep,
      params: { fileFilterRegex: "foo" },
    })
    await user.clear(screen.getByLabelText("Pattern"))
    const updated = store.get(stepsAtom)[0] as Step
    expect(updated.params.fileFilterRegex).toBeUndefined()
  })
})
