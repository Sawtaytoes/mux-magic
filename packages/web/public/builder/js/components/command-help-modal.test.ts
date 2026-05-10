import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"

// Browser-mode tests for the per-command help modal. The modal reads
// COMMANDS from commands.js and the description bundle from
// window.commandDescriptions, so we stub the latter; commands.js is
// real and shipped from the source tree.

declare global {
  interface Window {
    commandDescriptions?: Record<
      string,
      { summary: string; fields: Record<string, string> }
    >
    getCommandFieldDescription?: (input: {
      commandName: string
      fieldName: string
    }) => string
    getCommandSummary?: (input: {
      commandName: string
    }) => string
    commandLabel?: (name: string) => string
  }
}

const installCommandDescriptions = () => {
  window.commandDescriptions = {
    flattenOutput: {
      summary:
        "Flatten a chained step's output: copies the folder's contents up one level.",
      fields: {
        sourcePath:
          "Output folder produced by a previous step.",
        deleteSourceFolder:
          "If true, delete sourcePath after copying.",
      },
    },
  }
  window.getCommandFieldDescription = ({
    commandName,
    fieldName,
  }) =>
    window.commandDescriptions?.[commandName]?.fields?.[
      fieldName
    ] ?? ""
  window.getCommandSummary = ({ commandName }) =>
    window.commandDescriptions?.[commandName]?.summary ?? ""
  window.commandLabel = (name) => name
}

const mountModalDom = () => {
  const root = document.createElement("div")
  root.innerHTML = `
    <div id="command-help-modal" class="hidden">
      <span id="command-help-title"></span>
      <div id="command-help-body"></div>
    </div>
  `
  document.body.appendChild(root)
  return root
}

const testState: { mountedRoot: HTMLElement | null } = {
  mountedRoot: null,
}

beforeEach(() => {
  installCommandDescriptions()
  testState.mountedRoot = mountModalDom()
})

afterEach(() => {
  if (testState.mountedRoot) {
    testState.mountedRoot.remove()
    testState.mountedRoot = null
  }
})

describe("command-help-modal", () => {
  test("opens with the command's summary + per-field descriptions", async () => {
    const { openCommandHelpModal } = await import(
      "./command-help-modal.js"
    )
    openCommandHelpModal({ commandName: "flattenOutput" })

    const modalElement = document.getElementById(
      "command-help-modal",
    )
    const titleElement = document.getElementById(
      "command-help-title",
    )
    const bodyElement = document.getElementById(
      "command-help-body",
    )

    expect(modalElement?.classList.contains("hidden")).toBe(
      false,
    )
    expect(titleElement?.textContent).toContain(
      "flattenOutput",
    )
    expect(bodyElement?.textContent).toContain(
      "copies the folder's contents up one level",
    )
    expect(bodyElement?.textContent).toContain(
      "Output folder produced by a previous step.",
    )
    expect(bodyElement?.textContent).toContain(
      "delete sourcePath after copying",
    )
  })

  test("closes when called without an event", async () => {
    const { openCommandHelpModal, closeCommandHelpModal } =
      await import("./command-help-modal.js")
    openCommandHelpModal({ commandName: "flattenOutput" })

    const modalElement = document.getElementById(
      "command-help-modal",
    )
    expect(modalElement?.classList.contains("hidden")).toBe(
      false,
    )

    closeCommandHelpModal()
    expect(modalElement?.classList.contains("hidden")).toBe(
      true,
    )
  })

  test("no-ops on an unknown command", async () => {
    const { openCommandHelpModal } = await import(
      "./command-help-modal.js"
    )
    openCommandHelpModal({
      commandName: "thisCommandDoesNotExist",
    })

    const modalElement = document.getElementById(
      "command-help-modal",
    )
    expect(modalElement?.classList.contains("hidden")).toBe(
      true,
    )
  })
})
