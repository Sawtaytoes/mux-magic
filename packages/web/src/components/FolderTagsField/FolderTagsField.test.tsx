import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, test } from "vitest"
import { FIXTURE_COMMANDS_BUNDLE_E } from "../../commands/__fixtures__/commands"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { FolderTagsField } from "./FolderTagsField"

const createMockStep = (
  overrides?: Partial<Step>,
): Step => ({
  id: "step-1",
  alias: "",
  command: "extractSubtitles",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const renderField = (step: Step) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  const field =
    FIXTURE_COMMANDS_BUNDLE_E.extractSubtitles.fields[1]
  render(
    <Provider store={store}>
      <FolderTagsField step={step} field={field} />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

describe("FolderTagsField — tag rendering", () => {
  test("renders empty state with no tags", () => {
    const step = createMockStep()
    renderField(step)
    expect(
      screen.queryAllByRole("button", {
        name: /remove/i,
      }),
    ).toHaveLength(0)
  })

  test("renders existing folder values as removable tags", () => {
    const step = createMockStep({
      params: { folders: ["Subs", "Subtitles"] },
    })
    renderField(step)
    expect(screen.getByText("Subs")).toBeInTheDocument()
    expect(
      screen.getByText("Subtitles"),
    ).toBeInTheDocument()
  })

  test("each tag has a remove button with accessible title", () => {
    const step = createMockStep({
      params: { folders: ["Subs"] },
    })
    renderField(step)
    expect(
      screen.getByTitle(/remove Subs/i),
    ).toBeInTheDocument()
  })

  test("clicking remove updates stepsAtom to exclude that folder", async () => {
    const user = userEvent.setup()
    const step = createMockStep({
      params: { folders: ["Subs", "Subtitles"] },
    })
    const store = renderField(step)

    await user.click(screen.getByTitle(/remove Subs/i))

    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.folders).toEqual([
      "Subtitles",
    ])
  })

  test("removing the last tag sets the param to undefined", async () => {
    const user = userEvent.setup()
    const step = createMockStep({
      params: { folders: ["Subs"] },
    })
    const store = renderField(step)

    await user.click(screen.getByTitle(/remove Subs/i))

    const steps = store.get(stepsAtom)
    expect(
      (steps[0] as Step).params.folders,
    ).toBeUndefined()
  })

  test("uses field label component", () => {
    const step = createMockStep()
    renderField(step)
    expect(screen.getByText("Folders")).toBeInTheDocument()
  })
})

describe("FolderTagsField — typed input", () => {
  test("renders a text input for typing folder names", () => {
    const step = createMockStep()
    renderField(step)
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  test("typing a name and pressing Enter adds it as a tag", async () => {
    const user = userEvent.setup()
    const step = createMockStep()
    const store = renderField(step)

    await user.type(
      screen.getByRole("textbox"),
      "Subs{Enter}",
    )

    const steps = store.get(stepsAtom)
    expect((steps[0] as Step).params.folders).toContain(
      "Subs",
    )
  })

  test("pressing Enter clears the text input", async () => {
    const user = userEvent.setup()
    const step = createMockStep()
    renderField(step)

    await user.type(
      screen.getByRole("textbox"),
      "Subs{Enter}",
    )

    expect(screen.getByRole("textbox")).toHaveValue("")
  })

  test("pressing Enter on empty input does nothing", async () => {
    const user = userEvent.setup()
    const step = createMockStep()
    const store = renderField(step)

    await user.type(screen.getByRole("textbox"), "{Enter}")

    const steps = store.get(stepsAtom)
    expect(
      (steps[0] as Step).params.folders,
    ).toBeUndefined()
  })

  test("duplicate folder names are not added twice", async () => {
    const user = userEvent.setup()
    const step = createMockStep({
      params: { folders: ["Subs"] },
    })
    const store = renderField(step)

    await user.type(
      screen.getByRole("textbox"),
      "Subs{Enter}",
    )

    const steps = store.get(stepsAtom)
    const folders = (steps[0] as Step).params
      .folders as string[]
    expect(
      folders.filter((folder) => folder === "Subs"),
    ).toHaveLength(1)
  })

  test("has placeholder text describing its purpose", () => {
    const step = createMockStep()
    renderField(step)
    expect(
      screen.getByPlaceholderText(/folder name/i),
    ).toBeInTheDocument()
  })
})
