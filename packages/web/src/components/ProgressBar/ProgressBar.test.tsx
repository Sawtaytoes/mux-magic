import {
  cleanup,
  render,
  screen,
} from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import type { ProgressSnapshot } from "../../jobs/types"
import { ProgressBar } from "./ProgressBar"

afterEach(cleanup)

const renderBar = (snapshot: ProgressSnapshot) =>
  render(<ProgressBar snapshot={snapshot} />)

describe("ProgressBar fill", () => {
  test("renders a determinate bar at the given ratio", () => {
    renderBar({ ratio: 0.5 })
    const fill = screen.getByTestId("progress-fill")
    expect(fill.style.width).toBe("50%")
    expect(fill.className).not.toContain("animate-pulse")
  })

  test("renders indeterminate when ratio is absent", () => {
    renderBar({})
    const fill = screen.getByTestId("progress-fill")
    expect(fill.className).toContain("animate-pulse")
  })

  test("clamps ratio below 0 to 0%", () => {
    renderBar({ ratio: -0.5 })
    const fill = screen.getByTestId("progress-fill")
    expect(fill.style.width).toBe("0%")
  })

  test("clamps ratio above 1 to 100%", () => {
    renderBar({ ratio: 1.5 })
    const fill = screen.getByTestId("progress-fill")
    expect(fill.style.width).toBe("100%")
  })
})

describe("ProgressBar label", () => {
  test("shows files-done / files-total", () => {
    renderBar({ filesDone: 3, filesTotal: 10 })
    expect(
      screen.getByText(/3\/10 files/),
    ).toBeInTheDocument()
  })

  test("shows percentage when ratio is present", () => {
    renderBar({ ratio: 0.75 })
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })

  test("shows no label text when snapshot is empty", () => {
    renderBar({})
    // label div exists but is empty
    expect(screen.queryByText(/files/)).toBeNull()
    expect(screen.queryByText(/%/)).toBeNull()
  })
})

describe("ProgressBar per-file rows", () => {
  test("renders one row per currentFiles entry", () => {
    renderBar({
      currentFiles: [
        { path: "/a/file1.mkv", ratio: 0.3 },
        { path: "/b/file2.mkv" },
      ],
    })
    expect(
      screen.getByText("file1.mkv"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("file2.mkv"),
    ).toBeInTheDocument()
  })

  test("shows no file rows when currentFiles is empty", () => {
    renderBar({ ratio: 0.5, currentFiles: [] })
    expect(screen.queryByTitle(/\//)).toBeNull()
  })
})
