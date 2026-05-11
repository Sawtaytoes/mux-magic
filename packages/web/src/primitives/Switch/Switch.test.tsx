import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"
import { Switch } from "./Switch"

afterEach(cleanup)

describe("Switch appearance", () => {
  test("applies activeTrackClass when isOn is true", () => {
    const { container } = render(
      <Switch isOn={true} activeTrackClass="bg-amber-500 border-amber-400" />,
    )
    const track = container.firstChild as HTMLElement
    expect(track.className).toContain("bg-amber-500")
    expect(track.className).toContain("border-amber-400")
  })

  test("applies off-state classes when isOn is false", () => {
    const { container } = render(
      <Switch isOn={false} activeTrackClass="bg-amber-500 border-amber-400" />,
    )
    const track = container.firstChild as HTMLElement
    expect(track.className).toContain("bg-slate-600")
    expect(track.className).toContain("border-slate-500")
    expect(track.className).not.toContain("bg-amber-500")
  })

  test("thumb has translation when isOn is true", () => {
    const { container } = render(
      <Switch isOn={true} activeTrackClass="bg-emerald-500 border-emerald-400" />,
    )
    const thumb = container.querySelector("span > span") as HTMLElement
    expect(thumb.style.transform).toBe("translateX(1rem)")
  })

  test("thumb has no translation when isOn is false", () => {
    const { container } = render(
      <Switch isOn={false} activeTrackClass="bg-emerald-500 border-emerald-400" />,
    )
    const thumb = container.querySelector("span > span") as HTMLElement
    expect(thumb.style.transform).toBe("")
  })

  test("is hidden from accessibility tree", () => {
    render(
      <Switch isOn={true} activeTrackClass="bg-emerald-500 border-emerald-400" />,
    )
    expect(screen.queryByRole("presentation")).toBeNull()
  })
})
