import { describe, expect, test } from "vitest"
import type { Commands } from "../commands/types"
import type { PathVariable } from "../types"
import { loadYamlFromText } from "./loadYaml"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_PATHS: PathVariable[] = [
  { id: "basePath", label: "basePath", value: "" },
]

const FAKE_COMMANDS: Commands = {
  makeDirectory: {
    fields: [
      { name: "path", type: "path", isLinkable: true },
    ],
  },
  copyFiles: {
    fields: [
      { name: "source", type: "path", isLinkable: true },
      { name: "dest", type: "path", isLinkable: true },
    ],
  },
}

const load = (text: string) =>
  loadYamlFromText(text, FAKE_COMMANDS, BASE_PATHS, 0)

// ─── Blank / placeholder steps ────────────────────────────────────────────────

describe("blank placeholder steps", () => {
  test("allows steps with command: '' in YAML object form", () => {
    const yaml = `
paths:
  basePath:
    label: basePath
    value: ''
steps:
  - id: step1
    command: ''
    params: {}
`
    const result = load(yaml)
    expect(result.steps).toHaveLength(1)
    const step = result.steps[0] as {
      command: string
      id: string
    }
    expect(step.command).toBe("")
    expect(step.id).toBe("step1")
  })

  test("allows blank steps mixed with real steps", () => {
    const yaml = `
steps:
  - id: step1
    command: ''
    params: {}
  - id: step2
    command: makeDirectory
    params: {}
`
    const result = load(yaml)
    expect(result.steps).toHaveLength(2)
    const [blank, real] = result.steps as Array<{
      command: string
      id: string
    }>
    expect(blank.command).toBe("")
    expect(real.command).toBe("makeDirectory")
  })

  test("preserves alias and isCollapsed on blank steps", () => {
    const yaml = `
steps:
  - id: step3
    command: ''
    alias: my placeholder
    isCollapsed: true
    params: {}
`
    const result = load(yaml)
    const step = result.steps[0] as {
      alias: string
      isCollapsed: boolean
    }
    expect(step.alias).toBe("my placeholder")
    expect(step.isCollapsed).toBe(true)
  })
})

// ─── Step with a known command ────────────────────────────────────────────────

describe("steps with commands", () => {
  test("loads a step with known command and params", () => {
    const yaml = `
steps:
  - id: step1
    command: makeDirectory
    params:
      path: /tmp/output
`
    const result = load(yaml)
    expect(result.steps).toHaveLength(1)
    const step = result.steps[0] as {
      command: string
      params: Record<string, unknown>
    }
    expect(step.command).toBe("makeDirectory")
    expect(step.params.path).toBe("/tmp/output")
  })

  test("throws for a step with an unknown command", () => {
    const yaml = `
steps:
  - command: nonExistentCommand
    params: {}
`
    expect(() => load(yaml)).toThrow("Unknown command")
  })

  test("restores path-variable links from @-prefixed values", () => {
    const paths: PathVariable[] = [
      {
        id: "basePath",
        label: "basePath",
        value: "/media",
      },
    ]
    const yaml = `
steps:
  - command: makeDirectory
    params:
      path: '@basePath'
`
    const result = loadYamlFromText(
      yaml,
      FAKE_COMMANDS,
      paths,
      0,
    )
    const step = result.steps[0] as {
      links: Record<string, unknown>
    }
    expect(step.links.path).toBe("basePath")
  })

  test("restores step-output links from linkedTo object", () => {
    const yaml = `
steps:
  - command: makeDirectory
    params:
      path:
        linkedTo: step1
        output: folder
`
    const result = load(yaml)
    const step = result.steps[0] as {
      links: Record<string, unknown>
    }
    expect(step.links.path).toEqual({
      linkedTo: "step1",
      output: "folder",
    })
  })
})

// ─── Path restoration ─────────────────────────────────────────────────────────

describe("path restoration", () => {
  test("restores paths from canonical YAML format", () => {
    const yaml = `
paths:
  myPath:
    label: My Path
    value: /home/user/media
steps: []
`
    const result = load(yaml)
    expect(result.paths).toContainEqual({
      id: "myPath",
      label: "My Path",
      value: "/home/user/media",
    })
  })

  test("seeds basePath when loading legacy array format", () => {
    const yaml = `
- command: makeDirectory
  params: {}
`
    const result = load(yaml)
    expect(result.paths[0].id).toBe("basePath")
  })
})

// ─── Groups ───────────────────────────────────────────────────────────────────

describe("groups", () => {
  test("loads a serial group with inner steps", () => {
    const yaml = `
steps:
  - kind: group
    id: g1
    label: My Group
    isParallel: false
    steps:
      - command: makeDirectory
        params: {}
`
    const result = load(yaml)
    expect(result.steps).toHaveLength(1)
    const group = result.steps[0] as {
      kind: string
      steps: unknown[]
    }
    expect(group.kind).toBe("group")
    expect(group.steps).toHaveLength(1)
  })

  test("loads a group containing a blank step", () => {
    const yaml = `
steps:
  - kind: group
    id: g1
    isParallel: false
    steps:
      - id: step1
        command: ''
        params: {}
`
    const result = load(yaml)
    const group = result.steps[0] as {
      steps: Array<{ command: string }>
    }
    expect(group.steps[0].command).toBe("")
  })

  test("throws when group has no steps", () => {
    const yaml = `
steps:
  - kind: group
    id: g1
    isParallel: false
    steps: []
`
    expect(() => load(yaml)).toThrow("non-empty")
  })
})

// ─── variables block (threadCount) ───────────────────────────────────────────

describe("loadYaml — threadCount from variables block", () => {
  test("returns null threadCount when no variables block", () => {
    const yaml = `
paths:
  basePath:
    label: basePath
    value: ''
steps:
  - id: step1
    command: makeDirectory
    params: {}
`
    expect(load(yaml).threadCount).toBeNull()
  })

  test("parses threadCount value from variables block", () => {
    const yaml = `
paths:
  basePath:
    label: basePath
    value: ''
variables:
  tc:
    type: threadCount
    value: '4'
steps:
  - id: step1
    command: makeDirectory
    params: {}
`
    expect(load(yaml).threadCount).toBe("4")
  })

  test("ignores variables entries with non-threadCount type", () => {
    const yaml = `
paths:
  basePath:
    label: basePath
    value: ''
variables:
  myPath:
    type: path
    value: /some/path
steps:
  - id: step1
    command: makeDirectory
    params: {}
`
    expect(load(yaml).threadCount).toBeNull()
  })

  test("finds threadCount among multiple variable entries", () => {
    const yaml = `
paths:
  basePath:
    label: basePath
    value: ''
variables:
  myPath:
    type: path
    value: /some/path
  tc:
    type: threadCount
    value: '8'
steps:
  - id: step1
    command: makeDirectory
    params: {}
`
    expect(load(yaml).threadCount).toBe("8")
  })
})
