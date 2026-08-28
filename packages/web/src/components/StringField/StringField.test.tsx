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
import { lookupModalAtom } from "../LookupModal/lookupModalAtom"
import { StringField } from "./StringField"

const mockStep: Step = {
  id: "step1",
  alias: "",
  command: "ffmpeg",
  params: { filename: "output.mp4" },
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
}

const mockField: CommandField = {
  name: "filename",
  type: "string",
  label: "Filename",
  placeholder: "e.g. output.mp4",
}

const renderField = (
  step: Step = mockStep,
  field: CommandField = mockField,
) => {
  const store = createStore()
  store.set(stepsAtom, [step])
  render(
    <Provider store={store}>
      <StringField field={field} step={step} />
    </Provider>,
  )
  return store
}

afterEach(() => {
  cleanup()
})

describe("StringField", () => {
  test("renders a text input", () => {
    renderField()
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  test("renders the field label", () => {
    renderField()
    expect(screen.getByText("Filename")).toBeInTheDocument()
  })

  test("shows the current param value", () => {
    renderField()
    const input = screen.getByRole(
      "textbox",
    ) as HTMLInputElement
    expect(input.value).toBe("output.mp4")
  })

  test("shows the placeholder when provided", () => {
    const step = { ...mockStep, params: {} }
    renderField(step)
    expect(
      screen.getByPlaceholderText("e.g. output.mp4"),
    ).toBeInTheDocument()
  })

  test("empty string defaults to empty", () => {
    const step = { ...mockStep, params: { filename: "" } }
    renderField(step)
    const input = screen.getByRole(
      "textbox",
    ) as HTMLInputElement
    expect(input.value).toBe("")
  })

  test("opens release lookup for a string ID field", async () => {
    const user = userEvent.setup()
    const lookupField: CommandField = {
      name: "releaseId",
      type: "string",
      label: "MusicBrainz Release",
      lookupType: "musicbrainz",
      companionNameField: "releaseName",
    }
    const step: Step = {
      ...mockStep,
      params: { releaseId: "", releaseName: "" },
    }
    const store = renderField(step, lookupField)

    await user.click(
      screen.getByRole("button", {
        name: "Look up MusicBrainz Release",
      }),
    )

    expect(store.get(lookupModalAtom)).toEqual(
      expect.objectContaining({
        lookupType: "musicbrainz",
        stepId: "step1",
        fieldName: "releaseId",
        companionNameField: "releaseName",
        stage: "search",
      }),
    )
  })
})
