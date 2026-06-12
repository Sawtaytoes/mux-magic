import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import type { CommandField } from "../../commands/types"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import {
  ChapterSplitsField,
  parseChapterSplits,
} from "./ChapterSplitsField"

const field: CommandField = {
  name: "chapterSplits",
  type: "chapterSplits",
  label: "Chapter Splits",
  isRequired: true,
}

const makeStep = (
  params: Record<string, unknown> = {},
): Step => ({
  id: "step-1",
  alias: "",
  command: "splitChapters",
  params,
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
})

const renderField = (
  step: Step,
  fieldOverride: CommandField = field,
) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <ChapterSplitsField
        field={fieldOverride}
        step={step}
      />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

// The format (see splitChaptersCommand.ts / schema): a space-separated
// list of comma-separated chapter markers. Each whitespace-separated
// token is ONE file's split spec; commas inside a token are that file's
// chapters.
describe("parseChapterSplits", () => {
  test("keeps a single file's comma-separated chapters as one token", () => {
    // The reported regression: "6,9" means split one file at chapters 6
    // and 9 — it must NOT become two files ["6", "9"].
    expect(parseChapterSplits("6,9")).toEqual(["6,9"])
  })

  test("treats whitespace as the per-file separator", () => {
    expect(
      parseChapterSplits("7,18,26,33 6,17,25 6"),
    ).toEqual(["7,18,26,33", "6,17,25", "6"])
  })

  test("collapses runs of whitespace and trims", () => {
    expect(parseChapterSplits("  6,9   12   ")).toEqual([
      "6,9",
      "12",
    ])
  })

  test("returns an empty array for blank input", () => {
    expect(parseChapterSplits("")).toEqual([])
    expect(parseChapterSplits("   ")).toEqual([])
  })

  test("does not split a single chapter into characters", () => {
    expect(parseChapterSplits("6")).toEqual(["6"])
  })
})

describe("ChapterSplitsField", () => {
  test("renders the label with a required asterisk", () => {
    renderField(makeStep())
    expect(screen.getByText("Chapter Splits")).toBeVisible()
    expect(screen.getByText("*")).toBeVisible()
  })

  test("displays an empty string when value is undefined", () => {
    renderField(makeStep())
    expect(screen.getByRole("textbox")).toHaveValue("")
  })

  test("displays the array joined by spaces (not commas)", () => {
    renderField(
      makeStep({
        chapterSplits: ["7,18,26,33", "6,17,25", "6"],
      }),
    )
    expect(screen.getByRole("textbox")).toHaveValue(
      "7,18,26,33 6,17,25 6",
    )
  })

  test("does not render a link / path picker button", () => {
    // Regression: chapterSplits is typed by hand, never wired to a path
    // variable or upstream output.
    renderField(makeStep())
    expect(
      screen.queryByTitle(
        "Link to a path variable or step output",
      ),
    ).toBeNull()
    expect(screen.queryByText("— custom —")).toBeNull()
  })

  test("preserves raw text while typing — does not parse on change", () => {
    renderField(makeStep())
    const input = screen.getByRole("textbox")
    // Mid-type the comma must survive — the old StringArrayField rewrote
    // "6,9" into "6, 9" on every keystroke.
    fireEvent.change(input, { target: { value: "6,9" } })
    expect(input).toHaveValue("6,9")
  })

  test("saves a single file's chapters as one token on blur", () => {
    const step = makeStep()
    const store = renderField(step)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "6,9" } })
    fireEvent.blur(input)
    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.chapterSplits).toEqual(
      ["6,9"],
    )
  })

  test("saves whitespace-separated tokens as separate files on blur", () => {
    const step = makeStep()
    const store = renderField(step)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, {
      target: { value: "7,18,26,33 6,17,25 6" },
    })
    fireEvent.blur(input)
    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.chapterSplits).toEqual(
      ["7,18,26,33", "6,17,25", "6"],
    )
  })

  test("uses the field placeholder when provided", () => {
    renderField(makeStep(), {
      ...field,
      placeholder: "1,2 3,4",
    })
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "1,2 3,4",
    )
  })
})
