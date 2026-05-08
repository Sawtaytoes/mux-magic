import { describe, test, expect, beforeEach, afterEach } from "vitest"

// Browser-mode tests for the per-field hover tooltip component.
// Wires up the minimal DOM the component touches, populates
// window.commandDescriptions (the auto-generated bundle), and asserts
// that hovering a [data-tooltip-key] label after the configured delay
// reveals the popover with the matching description.

declare global {
  interface Window {
    commandDescriptions?: Record<string, { summary: string; fields: Record<string, string> }>
    getCommandFieldDescription?: (input: { commandName: string; fieldName: string }) => string
    getCommandSummary?: (input: { commandName: string }) => string
  }
}

const TOOLTIP_DELAY_MS = 200

const installCommandDescriptions = () => {
  window.commandDescriptions = {
    flattenOutput: {
      summary: "Flatten a chained step's output",
      fields: {
        sourcePath: "Output folder produced by a previous step.",
        deleteSourceFolder: "If true, delete sourcePath after copying.",
      },
    },
  }
  window.getCommandFieldDescription = ({ commandName, fieldName }) => (
    window.commandDescriptions?.[commandName]?.fields?.[fieldName] ?? ""
  )
  window.getCommandSummary = ({ commandName }) => (
    window.commandDescriptions?.[commandName]?.summary ?? ""
  )
}

const mountTooltipDom = () => {
  const root = document.createElement("div")
  root.innerHTML = `
    <div id="field-tooltip-popover" class="hidden"></div>
    <label id="anchor-source" data-tooltip-key="flattenOutput:sourcePath">Source Path</label>
    <label id="anchor-missing" data-tooltip-key="flattenOutput:nonExistent">Unknown</label>
  `
  document.body.appendChild(root)
  return root
}

const wait = (milliseconds: number) => (
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))
)

const testState: { mountedRoot: HTMLElement | null } = { mountedRoot: null }

beforeEach(() => {
  installCommandDescriptions()
  testState.mountedRoot = mountTooltipDom()
})

afterEach(() => {
  if (testState.mountedRoot) {
    testState.mountedRoot.remove()
    testState.mountedRoot = null
  }
})

describe("field-tooltip", () => {
  test("shows the schema description after hover delay", async () => {
    const { attachFieldTooltipListeners } = await import("./field-tooltip.js")
    attachFieldTooltipListeners()

    const anchorElement = document.getElementById("anchor-source")
    const tooltipElement = document.getElementById("field-tooltip-popover")

    expect(anchorElement).not.toBeNull()
    expect(tooltipElement).not.toBeNull()
    expect(tooltipElement!.classList.contains("hidden")).toBe(true)

    anchorElement!.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }))
    await wait(TOOLTIP_DELAY_MS + 50)

    expect(tooltipElement!.classList.contains("hidden")).toBe(false)
    expect(tooltipElement!.textContent).toBe("Output folder produced by a previous step.")
  })

  test("hides on pointerout", async () => {
    const { attachFieldTooltipListeners } = await import("./field-tooltip.js")
    attachFieldTooltipListeners()

    const anchorElement = document.getElementById("anchor-source")
    const tooltipElement = document.getElementById("field-tooltip-popover")

    anchorElement!.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }))
    await wait(TOOLTIP_DELAY_MS + 50)
    expect(tooltipElement!.classList.contains("hidden")).toBe(false)

    anchorElement!.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: document.body }))
    expect(tooltipElement!.classList.contains("hidden")).toBe(true)
  })

  test("stays hidden when description is missing", async () => {
    const { attachFieldTooltipListeners } = await import("./field-tooltip.js")
    attachFieldTooltipListeners()

    const anchorElement = document.getElementById("anchor-missing")
    const tooltipElement = document.getElementById("field-tooltip-popover")

    anchorElement!.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }))
    await wait(TOOLTIP_DELAY_MS + 50)

    expect(tooltipElement!.classList.contains("hidden")).toBe(true)
  })
})
