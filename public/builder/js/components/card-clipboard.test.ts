import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

// Per-card YAML clipboard tests: copy a single step or group out, paste
// it back in, with attention to ID remapping (so duplicates don't
// collide), internal `linkedTo` rewriting (so a copied group keeps its
// inner cross-step links), and path-var merge (existing path values
// take precedence over pasted ones).

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
type GroupLike = {
  kind: "group"
  id: string
  label: string
  isParallel: boolean
  isCollapsed: boolean
  steps: StepLike[]
}
type Item = StepLike | GroupLike

type MediaToolsMock = {
  paths: { id: string; label: string; value: string }[]
  steps: Item[]
  stepCounter: number
  COMMANDS: Record<
    string,
    {
      name: string
      fields: {
        name: string
        type: string
        default?: unknown
        companionNameField?: string
      }[]
    }
  >
  makeStep: (command: string | null) => StepLike
  initPaths: () => void
  buildParams: (step: StepLike) => Record<string, unknown>
  renderAll: ReturnType<typeof vi.fn>
  renderAllAnimated: ReturnType<typeof vi.fn>
  scrollStepIntoView: ReturnType<typeof vi.fn>
  updateYaml: ReturnType<typeof vi.fn>
  scheduleUpdateUrl: ReturnType<typeof vi.fn>
  updateUrl: ReturnType<typeof vi.fn>
  refreshLinkedInputs: ReturnType<typeof vi.fn>
  randomHex: () => string
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
let groupIdCounter: number

beforeEach(async () => {
  const yamlModule = await import("js-yaml")
  ;(window as Window).jsyaml = yamlModule
  groupIdCounter = 0

  let counter = 0
  mediaTools = {
    paths: [
      { id: "basePath", label: "basePath", value: "" },
    ],
    steps: [],
    stepCounter: 0,
    COMMANDS: {
      makeDirectory: {
        name: "makeDirectory",
        fields: [{ name: "filePath", type: "path" }],
      },
      copyFiles: {
        name: "copyFiles",
        fields: [
          { name: "sourcePath", type: "path" },
          { name: "destinationPath", type: "path" },
        ],
      },
    },
    makeStep: (command) => {
      counter += 1
      mediaTools.stepCounter = Math.max(
        mediaTools.stepCounter,
        counter,
      )
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
        mediaTools.paths = [
          { id: "basePath", label: "basePath", value: "" },
        ]
      }
    },
    buildParams: (step) => {
      const out: Record<string, unknown> = {}
      const cmd = mediaTools.COMMANDS[step.command ?? ""]
      if (!cmd) {
        return out
      }
      for (const field of cmd.fields) {
        const link = step.links[field.name]
        if (link !== undefined) {
          if (typeof link === "string") {
            out[field.name] = `@${link}`
          } else if (
            link &&
            typeof link === "object" &&
            "linkedTo" in link
          ) {
            out[field.name] = {
              linkedTo: (link as { linkedTo: string })
                .linkedTo,
              output:
                (link as { output?: string }).output ??
                "folder",
            }
          }
          continue
        }
        const value = step.params[field.name]
        if (
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          out[field.name] = value
        }
      }
      return out
    },
    renderAll: vi.fn(),
    renderAllAnimated: vi.fn(
      (afterRender?: (behavior: string) => void) => {
        if (afterRender) {
          afterRender("instant")
        }
      },
    ),
    scrollStepIntoView: vi.fn(),
    updateYaml: vi.fn(),
    scheduleUpdateUrl: vi.fn(),
    updateUrl: vi.fn(),
    refreshLinkedInputs: vi.fn(),
    // randomHex returns a unique value per call so groupId allocation
    // produces distinct IDs across the test (real impl uses
    // Math.random; deterministic counter keeps assertions readable).
    randomHex: () => {
      groupIdCounter += 1
      return `hex${groupIdCounter}`
    },
    kickReverseLookups: vi.fn(),
    kickTmdbResolutions: vi.fn(),
  }
  window.mediaTools = mediaTools
})

// Mock the clipboard. navigator.clipboard isn't writable in JSDOM by
// default; defineProperty + a held value let each test set what
// pasteCardAt will see. `clipboardError` lets a test simulate the
// NotAllowedError that browsers throw when the user denies the
// clipboard-read permission prompt.
let clipboardText = ""
let clipboardError: Error | null = null
const setClipboardText = (text: string) => {
  clipboardText = text
  clipboardError = null
}
const setClipboardError = (error: Error) => {
  clipboardError = error
}

beforeEach(() => {
  clipboardText = ""
  clipboardError = null
  Object.defineProperty(navigator, "clipboard", {
    value: {
      readText: () =>
        clipboardError
          ? Promise.reject(clipboardError)
          : Promise.resolve(clipboardText),
      writeText: (text: string) => {
        clipboardText = text
        return Promise.resolve()
      },
    },
    configurable: true,
    writable: true,
  })
  // Wipe any toast left behind by a previous test so DOM assertions
  // start from a clean slate.
  document.getElementById("clipboard-toast")?.remove()
})

describe("cardToYamlStr", () => {
  test("includes only the path-vars referenced by the step", async () => {
    const { cardToYamlStr } = await import(
      "./card-clipboard.js"
    )
    mediaTools.paths = [
      { id: "workDir", label: "Work Dir", value: "/work" },
      { id: "outDir", label: "Out Dir", value: "/out" },
      {
        id: "scratch",
        label: "Scratch",
        value: "/scratch",
      },
    ]
    const step: StepLike = {
      id: "step1",
      alias: "",
      command: "makeDirectory",
      params: {},
      links: { filePath: "workDir" },
      status: null,
      error: null,
      isCollapsed: false,
    }
    const yamlStr = cardToYamlStr(step)
    expect(yamlStr).toContain("workDir:")
    expect(yamlStr).not.toContain("outDir")
    expect(yamlStr).not.toContain("scratch")
    // Round-trip the dump to be sure the structure parses.
    const parsed = window.jsyaml.load(yamlStr) as {
      paths: Record<string, unknown>
      steps: unknown[]
    }
    expect(Object.keys(parsed.paths)).toEqual(["workDir"])
    expect(parsed.steps).toHaveLength(1)
  })

  test("includes path-vars referenced by any inner step of a group, deduped", async () => {
    const { cardToYamlStr } = await import(
      "./card-clipboard.js"
    )
    mediaTools.paths = [
      { id: "workDir", label: "Work Dir", value: "/work" },
      { id: "outDir", label: "Out Dir", value: "/out" },
      { id: "unused", label: "Unused", value: "/u" },
    ]
    const group: GroupLike = {
      kind: "group",
      id: "g1",
      label: "block",
      isParallel: false,
      isCollapsed: false,
      steps: [
        {
          id: "stepA",
          alias: "",
          command: "copyFiles",
          params: {},
          links: {
            sourcePath: "workDir",
            destinationPath: "outDir",
          },
          status: null,
          error: null,
          isCollapsed: false,
        },
        {
          id: "stepB",
          alias: "",
          command: "makeDirectory",
          params: {},
          links: { filePath: "workDir" },
          status: null,
          error: null,
          isCollapsed: false,
        },
      ],
    }
    const yamlStr = cardToYamlStr(group)
    const parsed = window.jsyaml.load(yamlStr) as {
      paths: Record<string, unknown>
      steps: unknown[]
    }
    expect(Object.keys(parsed.paths).sort()).toEqual([
      "outDir",
      "workDir",
    ])
    expect(yamlStr).not.toContain("unused")
  })
})

describe("pasteCardAt", () => {
  test("inserts a copied step with a fresh id; existing step ids unchanged", async () => {
    const { pasteCardAt } = await import(
      "./card-clipboard.js"
    )

    // Builder already has step1 + step2 in place.
    const existingStepOne =
      mediaTools.makeStep("makeDirectory")
    const existingStepTwo =
      mediaTools.makeStep("makeDirectory")
    mediaTools.steps.push(existingStepOne, existingStepTwo)

    setClipboardText(
      [
        "paths:",
        "  basePath: { label: basePath, value: '' }",
        "steps:",
        "  - id: step1",
        "    command: makeDirectory",
        "    params:",
        "      filePath: '@basePath'",
      ].join("\n"),
    )

    await pasteCardAt({ itemIndex: 1 })

    // Three items in the top-level list now: original step1, pasted, original step2.
    expect(mediaTools.steps).toHaveLength(3)
    expect((mediaTools.steps[0] as StepLike).id).toBe(
      "step1",
    )
    expect((mediaTools.steps[2] as StepLike).id).toBe(
      "step2",
    )
    const pasted = mediaTools.steps[1] as StepLike
    expect(pasted.id).not.toBe("step1")
    expect(pasted.id).not.toBe("step2")
    expect(pasted.command).toBe("makeDirectory")
    expect(pasted.links.filePath).toBe("basePath")
    expect(mediaTools.renderAllAnimated).toHaveBeenCalled()
    expect(
      mediaTools.scrollStepIntoView,
    ).toHaveBeenCalledWith(pasted.id)
  })

  test("group with internal linkedTo: inner refs rewrite to the new step ids", async () => {
    const { pasteCardAt } = await import(
      "./card-clipboard.js"
    )

    setClipboardText(
      [
        "paths:",
        "  basePath: { label: basePath, value: '' }",
        "steps:",
        "  - kind: group",
        "    id: para",
        "    isParallel: true",
        "    steps:",
        "      - id: producer",
        "        command: makeDirectory",
        "        params:",
        "          filePath: '@basePath'",
        "      - id: consumer",
        "        command: copyFiles",
        "        params:",
        "          sourcePath:",
        "            linkedTo: producer",
        "            output: folder",
        "          destinationPath: '@basePath'",
      ].join("\n"),
    )

    await pasteCardAt({ itemIndex: 0 })

    expect(mediaTools.steps).toHaveLength(1)
    const group = mediaTools.steps[0] as GroupLike
    expect(group.kind).toBe("group")
    // Group + inner step ids were all replaced.
    expect(group.id).not.toBe("para")
    expect(group.id.startsWith("group_")).toBe(true)
    expect(group.steps).toHaveLength(2)
    const producer = group.steps[0]
    const consumer = group.steps[1]
    expect(producer.id).not.toBe("producer")
    expect(consumer.id).not.toBe("consumer")
    // The internal linkedTo was rewritten from old "producer" to the
    // newly-allocated id of producer.
    const link = consumer.links.sourcePath as {
      linkedTo: string
      output: string
    }
    expect(link.linkedTo).toBe(producer.id)
    expect(link.output).toBe("folder")
  })

  test("path collision: existing path's value is preserved, pasted path is dropped", async () => {
    const { pasteCardAt } = await import(
      "./card-clipboard.js"
    )
    mediaTools.paths = [
      {
        id: "workDir",
        label: "Work Dir",
        value: "/existing",
      },
    ]

    setClipboardText(
      [
        "paths:",
        "  workDir: { label: 'Pasted label', value: '/pasted' }",
        "steps:",
        "  - id: step1",
        "    command: makeDirectory",
        "    params:",
        "      filePath: '@workDir'",
      ].join("\n"),
    )

    await pasteCardAt({ itemIndex: 0 })

    expect(mediaTools.paths).toHaveLength(1)
    expect(mediaTools.paths[0]).toEqual({
      id: "workDir",
      label: "Work Dir",
      value: "/existing",
    })
  })

  test("rejects pasting a kind:group payload into a group (no nesting)", async () => {
    const { pasteCardAt } = await import(
      "./card-clipboard.js"
    )
    const targetGroup: GroupLike = {
      kind: "group",
      id: "outer",
      label: "",
      isParallel: false,
      isCollapsed: false,
      steps: [mediaTools.makeStep("makeDirectory")],
    }
    mediaTools.steps.push(targetGroup)
    const stepCountBefore = targetGroup.steps.length

    setClipboardText(
      [
        "paths:",
        "  basePath: { label: basePath, value: '' }",
        "steps:",
        "  - kind: group",
        "    id: inner",
        "    steps:",
        "      - id: deep",
        "        command: makeDirectory",
        "        params:",
        "          filePath: '@basePath'",
      ].join("\n"),
    )

    await pasteCardAt({ parentGroupId: "outer" })

    // Group rejected — target group's inner steps unchanged.
    expect(targetGroup.steps).toHaveLength(stepCountBefore)
    expect(
      mediaTools.renderAllAnimated,
    ).not.toHaveBeenCalled()
  })

  test("paste into a group at a specific position", async () => {
    const { pasteCardAt } = await import(
      "./card-clipboard.js"
    )
    const innerStepOne =
      mediaTools.makeStep("makeDirectory")
    innerStepOne.id = "innerOne"
    const innerStepTwo =
      mediaTools.makeStep("makeDirectory")
    innerStepTwo.id = "innerTwo"
    const targetGroup: GroupLike = {
      kind: "group",
      id: "outer",
      label: "",
      isParallel: false,
      isCollapsed: false,
      steps: [innerStepOne, innerStepTwo],
    }
    mediaTools.steps.push(targetGroup)

    setClipboardText(
      [
        "paths:",
        "  basePath: { label: basePath, value: '' }",
        "steps:",
        "  - id: pasted",
        "    command: makeDirectory",
        "    params:",
        "      filePath: '@basePath'",
      ].join("\n"),
    )

    await pasteCardAt({
      parentGroupId: "outer",
      indexInParent: 1,
    })

    expect(targetGroup.steps).toHaveLength(3)
    expect(targetGroup.steps[0].id).toBe("innerOne")
    expect(targetGroup.steps[2].id).toBe("innerTwo")
    expect(targetGroup.steps[1].id).not.toBe("pasted")
    expect(targetGroup.steps[1].command).toBe(
      "makeDirectory",
    )
  })

  test("empty clipboard is a no-op (does not mutate state)", async () => {
    const { pasteCardAt } = await import(
      "./card-clipboard.js"
    )
    const stepOne = mediaTools.makeStep("makeDirectory")
    mediaTools.steps.push(stepOne)
    setClipboardText("   ")
    await pasteCardAt({ itemIndex: 0 })
    expect(mediaTools.steps).toHaveLength(1)
    expect(
      mediaTools.renderAllAnimated,
    ).not.toHaveBeenCalled()
  })

  test("NotAllowedError shows a permission-recovery toast and does not mutate state", async () => {
    const { pasteCardAt } = await import(
      "./card-clipboard.js"
    )
    const stepOne = mediaTools.makeStep("makeDirectory")
    mediaTools.steps.push(stepOne)
    // Real browsers throw a DOMException when clipboard permission is
    // denied. DOMException isn't always available in test envs — fall
    // back to a plain Error with the matching `name`.
    const denialError =
      typeof DOMException !== "undefined"
        ? new DOMException(
            "Read permission denied.",
            "NotAllowedError",
          )
        : Object.assign(
            new Error("Read permission denied."),
            { name: "NotAllowedError" },
          )
    setClipboardError(denialError)

    await pasteCardAt({ itemIndex: 0 })

    expect(mediaTools.steps).toHaveLength(1)
    expect(
      mediaTools.renderAllAnimated,
    ).not.toHaveBeenCalled()
    const toast = document.getElementById("clipboard-toast")
    expect(toast).not.toBeNull()
    expect(toast?.textContent).toMatch(/clipboard access/i)
    expect(toast?.textContent).toMatch(
      /address bar|site settings/i,
    )
  })
})
