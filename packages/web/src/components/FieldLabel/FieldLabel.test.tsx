import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "vitest"
import { FieldLabel } from "./FieldLabel"

afterEach(() => {
  cleanup()
})

describe("FieldLabel", () => {
  test("renders the field label text", () => {
    render(
      <FieldLabel
        command="ffmpeg"
        field={{ name: "filename", label: "Filename" }}
      />,
    )
    expect(screen.getByText("Filename")).toBeInTheDocument()
  })

  test("falls back to field name when label is absent", () => {
    render(
      <FieldLabel
        command="ffmpeg"
        field={{ name: "filename" }}
      />,
    )
    expect(screen.getByText("filename")).toBeInTheDocument()
  })

  test("shows a required asterisk when required is true", () => {
    render(
      <FieldLabel
        command="ffmpeg"
        field={{
          name: "filename",
          label: "Filename",
          required: true,
        }}
      />,
    )
    expect(screen.getByText("*")).toBeInTheDocument()
  })

  test("omits the required asterisk when required is false", () => {
    render(
      <FieldLabel
        command="ffmpeg"
        field={{
          name: "filename",
          label: "Filename",
          required: false,
        }}
      />,
    )
    expect(screen.queryByText("*")).toBeNull()
  })

  test("shows tooltip on click when description is provided", async () => {
    const user = userEvent.setup()
    render(
      <FieldLabel
        command="ffmpeg"
        field={{
          name: "filename",
          label: "Filename",
          description: "The output filename",
        }}
      />,
    )
    await user.click(screen.getByText("Filename"))
    expect(screen.getByRole("tooltip").textContent).toBe(
      "The output filename",
    )
  })
})
