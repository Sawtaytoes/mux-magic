import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it } from "vitest"
import { FIXTURE_COMMANDS_BUNDLE_C } from "../../commands/__fixtures__/commands"
import type { CommandField } from "../../commands/types"
import { linkPickerStateAtom } from "../../state/pickerAtoms"
import { stepsAtom } from "../../state/stepsAtom"
import type { Step } from "../../types"
import { StringArrayField } from "./StringArrayField"

const renderField = (
  step: Step,
  field: CommandField,
  otherSteps: Step[] = [],
) => {
  const store = createStore()
  store.set(stepsAtom, [...otherSteps, step])
  render(
    <Provider store={store}>
      <StringArrayField field={field} step={step} />
    </Provider>,
  )
  return store
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

  it("renders link button labeled '— custom —' when unlinked", () => {
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
    expect(
      screen.getByTitle(
        "Link to a path variable or step output",
      ),
    ).toBeVisible()
    expect(screen.getByText("— custom —")).toBeVisible()
  })

  it("clicking the link button opens the link picker for this field", async () => {
    const user = userEvent.setup()
    const step: Step = {
      id: "step-2",
      alias: "",
      command: "deleteCopiedOriginals",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }
    const pathsToDeleteField: CommandField = {
      name: "pathsToDelete",
      type: "stringArray",
      label: "Paths to Delete",
      isRequired: true,
    }

    const store = renderField(step, pathsToDeleteField)

    await user.click(
      screen.getByTitle(
        "Link to a path variable or step output",
      ),
    )

    const pickerState = store.get(linkPickerStateAtom)
    expect(pickerState?.anchor).toEqual({
      stepId: "step-2",
      fieldName: "pathsToDelete",
    })
  })

  it("hides the text input and shows the linked source when a step link is set", () => {
    const sourceStep: Step = {
      id: "step-1",
      alias: "",
      command: "copyFiles",
      params: {},
      links: {},
      status: null,
      error: null,
      isCollapsed: false,
    }
    const linkedStep: Step = {
      id: "step-2",
      alias: "",
      command: "deleteCopiedOriginals",
      params: {},
      links: {
        pathsToDelete: {
          linkedTo: "step-1",
          output: "copiedSourcePaths",
        },
      },
      status: null,
      error: null,
      isCollapsed: false,
    }
    const pathsToDeleteField: CommandField = {
      name: "pathsToDelete",
      type: "stringArray",
      label: "Paths to Delete",
      isRequired: true,
    }

    renderField(linkedStep, pathsToDeleteField, [
      sourceStep,
    ])

    expect(screen.queryByRole("textbox")).toBeNull()
    expect(
      screen.getAllByText(
        /Step 1: Copy Files → copiedSourcePaths/,
      ).length,
    ).toBeGreaterThan(0)
  })
})
