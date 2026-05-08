import { describe, test, expect, beforeEach, vi } from "vitest"
import { getByRole } from "@testing-library/dom"

// path-var-card.js reads window.mediaTools at call time (not import
// time), so we can populate the bridge in beforeEach and re-import the
// module on demand. The first test imports it, the rest reuse the
// cached module — fine, since the bridge is mutable.

type MediaToolsMock = {
  paths: { id: string; label: string; value: string }[]
  steps: { id: string; links: Record<string, unknown> }[]
  randomHex: () => string
  renderAll: ReturnType<typeof vi.fn>
  refreshLinkedInputs: ReturnType<typeof vi.fn>
  updateYaml: ReturnType<typeof vi.fn>
  scheduleUpdateUrl: ReturnType<typeof vi.fn>
  scrollPathVarIntoView: ReturnType<typeof vi.fn>
  schedulePathLookup: ReturnType<typeof vi.fn>
  pathPickerKeydown: ReturnType<typeof vi.fn>
}

declare global {
  interface Window {
    mediaTools: MediaToolsMock
  }
}

let mediaTools: MediaToolsMock

beforeEach(() => {
  mediaTools = {
    paths: [{ id: "basePath", label: "basePath", value: "" }],
    steps: [],
    randomHex: () => "deadbeef",
    renderAll: vi.fn(),
    refreshLinkedInputs: vi.fn(),
    updateYaml: vi.fn(),
    scheduleUpdateUrl: vi.fn(),
    scrollPathVarIntoView: vi.fn(),
    schedulePathLookup: vi.fn(),
    pathPickerKeydown: vi.fn(),
  }
  window.mediaTools = mediaTools
})

describe("renderPathVarCard", () => {
  test("emits delegated data-action attributes", async () => {
    const { renderPathVarCard } = await import("./path-var-card.js")
    const html = renderPathVarCard(
      { id: "wd", label: "Work Dir", value: "/work" },
      false,
    )
    expect(html).toContain('data-action="set-path-label"')
    expect(html).toContain('data-action="set-path-value"')
    expect(html).toContain('data-action="remove-path"')
    expect(html).toContain('data-pv-id="wd"')
    expect(html).toContain('data-keydown="path-picker"')
  })

  test("first card omits the remove button", async () => {
    const { renderPathVarCard } = await import("./path-var-card.js")
    const html = renderPathVarCard(
      { id: "basePath", label: "basePath", value: "" },
      true,
    )
    expect(html).not.toContain('data-action="remove-path"')
  })

  test("input values are HTML-escaped", async () => {
    const { renderPathVarCard } = await import("./path-var-card.js")
    const html = renderPathVarCard(
      { id: "x", label: '<script>"', value: "C:\\path" },
      false,
    )
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })
})

describe("addPath", () => {
  test("appends a new path with bridge-generated id and increments label", async () => {
    const { addPath } = await import("./path-var-card.js")
    addPath()
    expect(mediaTools.paths.length).toBe(2)
    expect(mediaTools.paths[1]).toMatchObject({
      id: "path_deadbeef",
      label: "Path 1",
      value: "",
    })
    expect(mediaTools.renderAll).toHaveBeenCalledOnce()
  })
})

describe("setPathLabel", () => {
  test("mutates the matching path and triggers persistence", async () => {
    const { setPathLabel } = await import("./path-var-card.js")
    setPathLabel("basePath", "New Label")
    expect(mediaTools.paths[0].label).toBe("New Label")
    expect(mediaTools.updateYaml).toHaveBeenCalledOnce()
    expect(mediaTools.scheduleUpdateUrl).toHaveBeenCalledOnce()
  })

  test("noop when id does not match any path", async () => {
    const { setPathLabel } = await import("./path-var-card.js")
    setPathLabel("nonexistent", "ignored")
    expect(mediaTools.paths[0].label).toBe("basePath")
    expect(mediaTools.updateYaml).not.toHaveBeenCalled()
  })
})

describe("setPathValue", () => {
  test("mutates value and refreshes linked inputs", async () => {
    const { setPathValue } = await import("./path-var-card.js")
    setPathValue("basePath", "/mnt/media")
    expect(mediaTools.paths[0].value).toBe("/mnt/media")
    expect(mediaTools.refreshLinkedInputs).toHaveBeenCalledOnce()
    expect(mediaTools.updateYaml).toHaveBeenCalledOnce()
  })
})

describe("removePath", () => {
  test("drops the path and clears matching step links", async () => {
    mediaTools.paths.push({ id: "wd", label: "Work Dir", value: "/work" })
    mediaTools.steps = [
      { id: "step1", links: { sourcePath: "wd", other: "basePath" } },
    ]
    const { removePath } = await import("./path-var-card.js")
    removePath("wd")
    expect(mediaTools.paths.map((p) => p.id)).toEqual(["basePath"])
    expect(mediaTools.steps[0].links.sourcePath).toBeUndefined()
    expect(mediaTools.steps[0].links.other).toBe("basePath")
    expect(mediaTools.renderAll).toHaveBeenCalledOnce()
  })

  test("refuses to remove the base path (index 0)", async () => {
    const { removePath } = await import("./path-var-card.js")
    removePath("basePath")
    expect(mediaTools.paths.length).toBe(1)
    expect(mediaTools.renderAll).not.toHaveBeenCalled()
  })
})

describe("attachPathVarListeners (event delegation)", () => {
  test("input on label field calls setPathLabel via the dispatcher", async () => {
    const { attachPathVarListeners, renderPathVarCard } =
      await import("./path-var-card.js")
    const root = document.createElement("div")
    root.innerHTML = renderPathVarCard(
      { id: "basePath", label: "", value: "" },
      true,
    )
    document.body.appendChild(root)
    attachPathVarListeners(root)
    const labelInput = root.querySelector<HTMLInputElement>(
      '[data-action="set-path-label"]',
    )!
    labelInput.value = "Edited"
    labelInput.dispatchEvent(new Event("input", { bubbles: true }))
    expect(mediaTools.paths[0].label).toBe("Edited")
    root.remove()
  })

  test("click on remove button calls removePath", async () => {
    mediaTools.paths.push({ id: "wd", label: "Work Dir", value: "/work" })
    const { attachPathVarListeners, renderPathVarCard } =
      await import("./path-var-card.js")
    const root = document.createElement("div")
    root.innerHTML = renderPathVarCard(
      { id: "wd", label: "Work Dir", value: "/work" },
      false,
    )
    document.body.appendChild(root)
    attachPathVarListeners(root)
    const removeBtn = getByRole(root, "button", { name: /remove path variable/i })
    removeBtn.click()
    expect(mediaTools.paths.map((p) => p.id)).toEqual(["basePath"])
    expect(mediaTools.renderAll).toHaveBeenCalledOnce()
    root.remove()
  })

  test("keydown on value input forwards to bridge.pathPickerKeydown", async () => {
    const { attachPathVarListeners, renderPathVarCard } =
      await import("./path-var-card.js")
    const root = document.createElement("div")
    root.innerHTML = renderPathVarCard(
      { id: "basePath", label: "", value: "" },
      true,
    )
    document.body.appendChild(root)
    attachPathVarListeners(root)
    const valueInput = root.querySelector<HTMLInputElement>(
      '[data-action="set-path-value"]',
    )!
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    valueInput.dispatchEvent(event)
    expect(mediaTools.pathPickerKeydown).toHaveBeenCalledOnce()
    root.remove()
  })
})
