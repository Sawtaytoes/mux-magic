import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FieldLabel } from "./FieldLabel"

afterEach(() => {
  cleanup()
})

describe("FieldLabel", () => {
  it("renders the field label text", () => {
    render(
      <FieldLabel
        command="ffmpeg"
        field={{ name: "filename", label: "Filename" }}
      />,
    )
    expect(screen.getByText("Filename")).toBeInTheDocument()
  })

  it("falls back to field name when label is absent", () => {
    render(
      <FieldLabel
        command="ffmpeg"
        field={{ name: "filename" }}
      />,
    )
    expect(screen.getByText("filename")).toBeInTheDocument()
  })

  it("shows a required asterisk when required is true", () => {
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

  it("omits the required asterisk when required is false", () => {
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

  it("sets the tooltip data attribute", () => {
    const { container } = render(
      <FieldLabel
        command="ffmpeg"
        field={{ name: "filename", label: "Filename" }}
      />,
    )
    const label = container.querySelector(
      "[data-tooltip-key]",
    )
    expect(label?.getAttribute("data-tooltip-key")).toBe(
      "ffmpeg:filename",
    )
  })
})
