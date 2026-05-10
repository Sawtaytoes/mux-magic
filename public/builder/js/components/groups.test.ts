import { describe, test, expect, beforeEach, vi } from "vitest"

// Round-trip tests for the group support in load-modal + yaml-modal.
// Both modules read window.mediaTools at call time (not import time)
// so we populate a stub bridge in beforeEach. The COMMANDS registry
// is just enough surface for the two commands used here (makeDirectory
// and copyFiles), which is the same shape the real index.html builds
// from the server's command schema.

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
  COMMANDS: Record<string, {
    name: string
    fields: { name: string; type: string; default?: unknown; companionNameField?: string }[]
  }>
  makeStep: (command: string | null) => StepLike
  initPaths: () => void
  buildParams: (step: StepLike) => Record<string, unknown>
  renderAll: ReturnType<typeof vi.fn>
  updateYaml: ReturnType<typeof vi.fn>
  scheduleUpdateUrl: ReturnType<typeof vi.fn>
  updateUrl: ReturnType<typeof vi.fn>
  refreshLinkedInputs: ReturnType<typeof vi.fn>
  randomHex: () => string
}

declare global {
  interface Window {
    mediaTools: MediaToolsMock
    jsyaml: typeof import("js-yaml")
  }
}

let mediaTools: MediaToolsMock

beforeEach(async () => {
  // js-yaml is loaded into window in the production page via a vendor
  // <script>; in tests we import the module and put it on window so
  // load-modal + yaml-modal find it.
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
    // buildParams here mirrors the production logic just enough to
    // round-trip path-var refs and step-output refs into their YAML
    // forms (`@pathId`, `{linkedTo, output}`). It's intentionally
    // dumber than the real one — that one lives in the inline script.
    buildParams: (step) => {
      const out: Record<string, unknown> = {}
      const cmd = mediaTools.COMMANDS[step.command ?? ""]
      if (!cmd) return out
      for (const field of cmd.fields) {
        const link = step.links[field.name]
        if (link !== undefined) {
          if (typeof link === "string") {
            out[field.name] = "@" + link
          } else if (link && typeof link === "object" && "linkedTo" in link) {
            out[field.name] = {
              linkedTo: (link as { linkedTo: string }).linkedTo,
              output: (link as { output?: string }).output ?? "folder",
            }
          }
          continue
        }
        const value = step.params[field.name]
        if (value !== undefined && value !== null && value !== "") {
          out[field.name] = value
        }
      }
      return out
    },
    renderAll: vi.fn(),
    updateYaml: vi.fn(),
    scheduleUpdateUrl: vi.fn(),
    updateUrl: vi.fn(),
    refreshLinkedInputs: vi.fn(),
    randomHex: () => "deadbeef",
  }
  window.mediaTools = mediaTools
})

describe("loadYamlFromText: groups", () => {
  test("parses a top-level kind:group entry into a group object with inner steps", async () => {
    const { loadYamlFromText } = await import("./load-modal.js")
    loadYamlFromText([
      "paths:",
      "  workDir:",
      "    label: Work Directory",
      "    value: /work",
      "steps:",
      "  - id: prepare",
      "    command: makeDirectory",
      "    params:",
      "      filePath: '@workDir'",
      "  - kind: group",
      "    id: extractParallel",
      "    label: Extract subs + media info",
      "    isParallel: true",
      "    steps:",
      "      - id: subs",
      "        command: makeDirectory",
      "        params:",
      "          filePath: '@workDir'",
      "      - id: info",
      "        command: makeDirectory",
      "        params:",
      "          filePath: '@workDir'",
    ].join("\n"))

    const items = mediaTools.steps
    expect(items).toHaveLength(2)
    expect("kind" in items[0] && items[0].kind === "group").toBe(false)
    expect((items[0] as StepLike).id).toBe("prepare")

    const group = items[1] as GroupLike
    expect(group.kind).toBe("group")
    expect(group.id).toBe("extractParallel")
    expect(group.label).toBe("Extract subs + media info")
    expect(group.isParallel).toBe(true)
    expect(group.steps).toHaveLength(2)
    expect(group.steps[0].id).toBe("subs")
    expect(group.steps[1].id).toBe("info")
  })

  test("parses isCollapsed on step + group entries", async () => {
    const { loadYamlFromText } = await import("./load-modal.js")
    loadYamlFromText([
      "steps:",
      "  - id: collapsedStep",
      "    command: makeDirectory",
      "    params:",
      "      filePath: /a",
      "    isCollapsed: true",
      "  - kind: group",
      "    id: collapsedGroup",
      "    isCollapsed: true",
      "    steps:",
      "      - id: inner",
      "        command: makeDirectory",
      "        params:",
      "          filePath: /b",
      "        isCollapsed: true",
    ].join("\n"))

    const items = mediaTools.steps
    expect((items[0] as StepLike).isCollapsed).toBe(true)
    const group = items[1] as GroupLike
    expect(group.isCollapsed).toBe(true)
    expect(group.steps[0].isCollapsed).toBe(true)
  })

  test("rejects nested groups with a clear error", async () => {
    const { loadYamlFromText } = await import("./load-modal.js")
    expect(() => {
      loadYamlFromText([
        "steps:",
        "  - kind: group",
        "    steps:",
        "      - kind: group",
        "        steps:",
        "          - id: way-too-deep",
        "            command: makeDirectory",
        "            params:",
        "              filePath: /a",
      ].join("\n"))
    }).toThrowError(/cannot be nested/i)
  })
})

describe("toYamlStr: groups", () => {
  test("emits group entries with kind:group and the configured flags", async () => {
    const { toYamlStr } = await import("./yaml-modal.js")
    mediaTools.paths = [{ id: "workDir", label: "Work Directory", value: "/work" }]
    mediaTools.steps = [
      {
        id: "prepare",
        alias: "",
        command: "makeDirectory",
        params: {},
        links: { filePath: "workDir" },
        status: null,
        error: null,
        isCollapsed: false,
      },
      {
        kind: "group",
        id: "para",
        label: "Parallel block",
        isParallel: true,
        isCollapsed: false,
        steps: [
          {
            id: "subs",
            alias: "",
            command: "makeDirectory",
            params: {},
            links: { filePath: "workDir" },
            status: null,
            error: null,
            isCollapsed: false,
          },
          {
            id: "info",
            alias: "",
            command: "makeDirectory",
            params: {},
            links: { filePath: "workDir" },
            status: null,
            error: null,
            isCollapsed: true,
          },
        ],
      },
    ]

    const yamlStr = toYamlStr()
    expect(yamlStr).toContain("kind: group")
    expect(yamlStr).toContain("id: para")
    expect(yamlStr).toContain("label: Parallel block")
    expect(yamlStr).toContain("isParallel: true")
    // Inner step with isCollapsed: true emits the flag; the other inner
    // step has isCollapsed: false and should NOT emit a noisy default.
    expect(yamlStr).toContain("isCollapsed: true")
    // The first non-collapsed step shouldn't add a key — count
    // occurrences (`isCollapsed: true` appears exactly once).
    expect((yamlStr.match(/isCollapsed/g) ?? []).length).toBe(1)
  })

  test("round-trips a group through load → toYaml without losing data", async () => {
    const { loadYamlFromText } = await import("./load-modal.js")
    const { toYamlStr } = await import("./yaml-modal.js")

    const original = [
      "paths:",
      "  workDir:",
      "    label: Work Directory",
      "    value: /work",
      "steps:",
      "  - id: prepare",
      "    command: makeDirectory",
      "    params:",
      "      filePath: '@workDir'",
      "  - kind: group",
      "    id: para",
      "    label: Parallel block",
      "    isParallel: true",
      "    steps:",
      "      - id: subs",
      "        command: makeDirectory",
      "        params:",
      "          filePath: '@workDir'",
      "      - id: info",
      "        command: makeDirectory",
      "        params:",
      "          filePath: '@workDir'",
    ].join("\n")

    loadYamlFromText(original)
    const dumped = toYamlStr()

    // Reload from the dumped form — the structure must match.
    const reloaded = window.jsyaml.load(dumped) as { steps: unknown[] }
    expect(Array.isArray(reloaded.steps)).toBe(true)
    expect(reloaded.steps).toHaveLength(2)
    expect((reloaded.steps[0] as { id: string }).id).toBe("prepare")
    const reGroup = reloaded.steps[1] as {
      kind: string
      id: string
      isParallel: boolean
      steps: { id: string }[]
    }
    expect(reGroup.kind).toBe("group")
    expect(reGroup.id).toBe("para")
    expect(reGroup.isParallel).toBe(true)
    expect(reGroup.steps.map((step) => step.id)).toEqual(["subs", "info"])
  })
})
