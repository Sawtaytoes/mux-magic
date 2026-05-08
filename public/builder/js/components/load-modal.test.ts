import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"

// Tests for the paste-driven load modal: opening reveals the surface,
// pasting anywhere on the page hydrates the builder, errors stay in
// the modal, Esc closes via the shared modal-keys handler.

type StepLike = {
  id: string
  alias: string
  command: string | null
  params: Record<string, unknown>
  links: Record<string, unknown>
  status: null
  error: null
  isCollapsed: boolean
}

type MediaToolsMock = {
  paths: { id: string; label: string; value: string }[]
  steps: StepLike[]
  stepCounter: number
  COMMANDS: Record<string, {
    name: string
    fields: { name: string; type: string }[]
  }>
  makeStep: (command: string | null) => StepLike
  initPaths: () => void
  buildParams: ReturnType<typeof vi.fn>
  renderAll: ReturnType<typeof vi.fn>
  updateUrl: ReturnType<typeof vi.fn>
  closeLoadModal?: ReturnType<typeof vi.fn>
  kickReverseLookups: ReturnType<typeof vi.fn>
  kickTmdbResolutions: ReturnType<typeof vi.fn>
}

declare global {
  interface Window {
    mediaTools: MediaToolsMock
    jsyaml: typeof import("js-yaml")
  }
}

let mediaTools: MediaToolsMock

// Minimal modal markup the load-modal module reaches into. Each test
// gets a clean instance attached to body; afterEach removes it so
// subsequent tests don't reuse stale DOM.
function mountModalMarkup() {
  const root = document.createElement("div")
  root.innerHTML = `
    <div id="load-modal" class="hidden"></div>
    <div id="yaml-modal" class="hidden"></div>
    <div id="api-run-modal" class="hidden"></div>
    <p id="load-error" class="hidden"></p>
  `
  document.body.appendChild(root)
  return root
}

let mountedRoot: HTMLElement | null = null

beforeEach(async () => {
  const yamlModule = await import("js-yaml")
  ;(window as Window).jsyaml = yamlModule

  let counter = 0
  mediaTools = {
    paths: [{ id: "basePath", label: "basePath", value: "" }],
    steps: [],
    stepCounter: 0,
    COMMANDS: {
      makeDirectory: {
        name: "makeDirectory",
        fields: [{ name: "filePath", type: "path" }],
      },
    },
    makeStep: (command) => {
      counter += 1
      mediaTools.stepCounter = Math.max(mediaTools.stepCounter, counter)
      return {
        id: `step${counter}`,
        alias: "",
        command,
        params: {},
        links: {},
        status: null,
        error: null,
        isCollapsed: false,
      }
    },
    initPaths: () => {
      if (!mediaTools.paths.length) {
        mediaTools.paths = [{ id: "basePath", label: "basePath", value: "" }]
      }
    },
    buildParams: vi.fn(),
    renderAll: vi.fn(),
    updateUrl: vi.fn(),
    kickReverseLookups: vi.fn(),
    kickTmdbResolutions: vi.fn(),
  }
  window.mediaTools = mediaTools

  mountedRoot = mountModalMarkup()
})

afterEach(() => {
  mountedRoot?.remove()
  mountedRoot = null
})

describe("openLoadModal / closeLoadModal", () => {
  test("openLoadModal reveals #load-modal and clears any stale error", async () => {
    const loadError = document.getElementById("load-error")!
    loadError.textContent = "stale message"
    loadError.classList.remove("hidden")

    const { openLoadModal } = await import("./load-modal.js")
    openLoadModal()

    expect(document.getElementById("load-modal")?.classList.contains("hidden")).toBe(false)
    expect(loadError.classList.contains("hidden")).toBe(true)
  })

  test("closeLoadModal hides the modal", async () => {
    const { openLoadModal, closeLoadModal } = await import("./load-modal.js")
    openLoadModal()
    closeLoadModal()
    expect(document.getElementById("load-modal")?.classList.contains("hidden")).toBe(true)
  })

  test("closeLoadModal with a backdrop event only closes when clicking the modal element itself", async () => {
    const { openLoadModal, closeLoadModal } = await import("./load-modal.js")
    openLoadModal()
    const inner = document.createElement("div")
    document.getElementById("load-modal")!.appendChild(inner)
    // Click bubbled from the inner panel — should NOT close.
    closeLoadModal({ target: inner } as unknown as Event)
    expect(document.getElementById("load-modal")?.classList.contains("hidden")).toBe(false)
    // Click on the modal backdrop itself — closes.
    closeLoadModal({ target: document.getElementById("load-modal") } as unknown as Event)
    expect(document.getElementById("load-modal")?.classList.contains("hidden")).toBe(true)
  })
})

describe("paste-anywhere → load", () => {
  function dispatchPaste(text: string) {
    // ClipboardEvent isn't constructable everywhere; build a plain
    // Event and stamp `clipboardData` on it. The handler only reads
    // `event.clipboardData?.getData('text/plain')` so this is enough.
    const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
      clipboardData: { getData: (type: string) => string }
    }
    Object.defineProperty(event, "clipboardData", {
      value: { getData: (_type: string) => text },
    })
    document.dispatchEvent(event)
  }

  test("a paste while the modal is open hydrates the builder and closes the modal", async () => {
    const { openLoadModal } = await import("./load-modal.js")
    openLoadModal()

    dispatchPaste([
      "paths:",
      "  basePath: { label: basePath, value: '' }",
      "steps:",
      "  - id: step1",
      "    command: makeDirectory",
      "    params:",
      "      filePath: '@basePath'",
    ].join("\n"))

    expect(mediaTools.steps).toHaveLength(1)
    expect(mediaTools.steps[0].id).toBe("step1")
    expect(mediaTools.renderAll).toHaveBeenCalled()
    expect(mediaTools.updateUrl).toHaveBeenCalled()
    expect(document.getElementById("load-modal")?.classList.contains("hidden")).toBe(true)
  })

  test("empty / whitespace-only paste is ignored", async () => {
    const { openLoadModal } = await import("./load-modal.js")
    openLoadModal()
    dispatchPaste("   \n\t  ")
    expect(mediaTools.renderAll).not.toHaveBeenCalled()
    // Modal stays open so the user can try again.
    expect(document.getElementById("load-modal")?.classList.contains("hidden")).toBe(false)
  })

  test("invalid YAML keeps the modal open and surfaces the error", async () => {
    const { openLoadModal } = await import("./load-modal.js")
    openLoadModal()
    dispatchPaste("not a real sequence — just a string")
    expect(document.getElementById("load-modal")?.classList.contains("hidden")).toBe(false)
    const loadError = document.getElementById("load-error")!
    expect(loadError.classList.contains("hidden")).toBe(false)
    expect(loadError.textContent).toBeTruthy()
    expect(mediaTools.renderAll).not.toHaveBeenCalled()
  })

  test("a paste after the modal closes is ignored (listener detached)", async () => {
    const { openLoadModal, closeLoadModal } = await import("./load-modal.js")
    openLoadModal()
    closeLoadModal()
    dispatchPaste([
      "steps:",
      "  - id: step1",
      "    command: makeDirectory",
      "    params:",
      "      filePath: '@basePath'",
    ].join("\n"))
    expect(mediaTools.renderAll).not.toHaveBeenCalled()
  })
})

describe("attachModalEscapeListener", () => {
  function dispatchEscape() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  }

  test("Esc on an open #load-modal routes through closeLoadModal (detaches paste listener)", async () => {
    const { openLoadModal } = await import("./load-modal.js")
    const { attachModalEscapeListener } = await import("../util/modal-keys.js")
    // Wire the bridge entry the Esc handler routes through.
    const realCloseLoadModal = (await import("./load-modal.js")).closeLoadModal
    mediaTools.closeLoadModal = vi.fn(realCloseLoadModal)

    attachModalEscapeListener()
    openLoadModal()

    dispatchEscape()
    expect(mediaTools.closeLoadModal).toHaveBeenCalled()
    expect(document.getElementById("load-modal")?.classList.contains("hidden")).toBe(true)
  })

  test("Esc on an open #yaml-modal closes it directly", async () => {
    const { attachModalEscapeListener } = await import("../util/modal-keys.js")
    attachModalEscapeListener()
    const yamlModal = document.getElementById("yaml-modal")!
    yamlModal.classList.remove("hidden")
    dispatchEscape()
    expect(yamlModal.classList.contains("hidden")).toBe(true)
  })

  test("Esc on an open #api-run-modal closes it directly", async () => {
    const { attachModalEscapeListener } = await import("../util/modal-keys.js")
    attachModalEscapeListener()
    const apiRunModal = document.getElementById("api-run-modal")!
    apiRunModal.classList.remove("hidden")
    dispatchEscape()
    expect(apiRunModal.classList.contains("hidden")).toBe(true)
  })

  test("Esc with no modal open is a no-op", async () => {
    const { attachModalEscapeListener } = await import("../util/modal-keys.js")
    attachModalEscapeListener()
    // All three start hidden; press Esc; none should change.
    dispatchEscape()
    expect(document.getElementById("load-modal")?.classList.contains("hidden")).toBe(true)
    expect(document.getElementById("yaml-modal")?.classList.contains("hidden")).toBe(true)
    expect(document.getElementById("api-run-modal")?.classList.contains("hidden")).toBe(true)
  })
})
