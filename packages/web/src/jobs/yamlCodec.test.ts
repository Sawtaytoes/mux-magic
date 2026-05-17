import yaml from "js-yaml"
import { describe, expect, test, vi } from "vitest"
import type { Commands } from "../commands/types"
import type {
  PathVariable,
  SequenceItem,
  Step,
  Variable,
} from "../types"
import { loadYamlFromText, toYamlStr } from "./yamlCodec"

// ─── Shared helpers ───────────────────────────────────────────────────────────

const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: "step-1",
  alias: "",
  command: "makeDirectory",
  params: {},
  links: {},
  status: null,
  error: null,
  isCollapsed: false,
  ...overrides,
})

const BASE_PATH: PathVariable = {
  id: "basePath",
  label: "Base Path",
  value: "/fixture/media",
  type: "path",
}

const BASE_PATHS: PathVariable[] = [
  {
    id: "basePath",
    label: "basePath",
    value: "",
    type: "path",
  },
]

const MAKE_DIR_COMMAND: Commands = {
  makeDirectory: {
    fields: [
      {
        name: "sourcePath",
        type: "path",
        label: "Source Path",
        isRequired: true,
      },
    ],
  },
}

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
  loadYamlFromText(text, FAKE_COMMANDS, BASE_PATHS)

// ─── toYamlStr — empty states ─────────────────────────────────────────────────

describe("toYamlStr — empty states", () => {
  test("returns sentinel when steps is empty and no path values set", () => {
    const paths: PathVariable[] = [
      {
        id: "basePath",
        label: "Base Path",
        value: "",
        type: "path",
      },
    ]
    expect(toYamlStr([], paths, {})).toBe("# No steps yet")
  })

  test("returns sentinel when steps list is empty", () => {
    expect(toYamlStr([], [], {})).toBe("# No steps yet")
  })
})

// ─── toYamlStr — link resolution ─────────────────────────────────────────────

describe("toYamlStr — link resolution", () => {
  test("string link becomes @<id> in serialized params", () => {
    const step = makeStep({
      command: "makeDirectory",
      links: { sourcePath: "basePath" },
    })
    const paths: PathVariable[] = [BASE_PATH]

    const result = toYamlStr(
      [step] as SequenceItem[],
      paths,
      MAKE_DIR_COMMAND,
    )

    expect(result).toContain("sourcePath: '@basePath'")
  })

  test("object link is serialized as linkedTo/output object", () => {
    const step = makeStep({
      command: "makeDirectory",
      links: {
        sourcePath: {
          linkedTo: "prev-step",
          output: "folder",
        },
      },
    })
    const paths: PathVariable[] = [BASE_PATH]

    const result = toYamlStr(
      [step] as SequenceItem[],
      paths,
      MAKE_DIR_COMMAND,
    )

    expect(result).toContain("linkedTo: prev-step")
    expect(result).toContain("output: folder")
  })
})

// ─── toYamlStr — buildParams default omission ────────────────────────────────

describe("toYamlStr — buildParams default omission", () => {
  test("field at its default value is omitted from output", () => {
    const commands: Commands = {
      remuxToMkv: {
        fields: [
          {
            name: "sourcePath",
            type: "path",
            isRequired: true,
          },
          {
            name: "isRecursive",
            type: "boolean",
            default: false,
          },
        ],
      },
    }
    const step = makeStep({
      command: "remuxToMkv",
      params: { isRecursive: false },
      links: { sourcePath: "basePath" },
    })

    const result = toYamlStr(
      [step] as SequenceItem[],
      [BASE_PATH],
      commands,
    )

    expect(result).not.toContain("isRecursive")
  })

  test("field above its default value is included in output", () => {
    const commands: Commands = {
      remuxToMkv: {
        fields: [
          {
            name: "sourcePath",
            type: "path",
            isRequired: true,
          },
          {
            name: "isRecursive",
            type: "boolean",
            default: false,
          },
        ],
      },
    }
    const step = makeStep({
      command: "remuxToMkv",
      params: { isRecursive: true },
      links: { sourcePath: "basePath" },
    })

    const result = toYamlStr(
      [step] as SequenceItem[],
      [BASE_PATH],
      commands,
    )

    expect(result).toContain("isRecursive: true")
  })
})

// ─── toYamlStr — unknown command fallback ────────────────────────────────────

describe("toYamlStr — unknown command fallback", () => {
  test("falls back to raw step.params when command not in commands map", () => {
    const step = makeStep({
      command: "unknownCommand",
      params: { someField: "some-value" },
    })

    const result = toYamlStr(
      [step] as SequenceItem[],
      [BASE_PATH],
      {},
    )

    expect(result).toContain("someField: some-value")
  })
})

// ─── toYamlStr — paths block (legacy — still passes, tests content not key name) ─

describe("toYamlStr — paths block", () => {
  test("path variable with value appears in output", () => {
    const step = makeStep({
      command: "makeDirectory",
      links: { sourcePath: "basePath" },
    })

    const result = toYamlStr(
      [step] as SequenceItem[],
      [BASE_PATH],
      MAKE_DIR_COMMAND,
    )

    expect(result).toContain("basePath:")
    expect(result).toContain("value: /fixture/media")
  })
})

// ─── toYamlStr — variables: block output ────────────────────────────────────

describe("toYamlStr — variables: block output", () => {
  const PATH_VAR: Variable = {
    id: "basePath",
    label: "Base",
    value: "/mnt/media",
    type: "path",
  }

  test("writes variables: key, not paths:", () => {
    const result = toYamlStr(
      [],
      [PATH_VAR],
      MAKE_DIR_COMMAND,
    )
    const parsed = yaml.load(result) as Record<
      string,
      unknown
    >
    expect(parsed).toHaveProperty("variables")
    expect(parsed).not.toHaveProperty("paths")
  })

  test("each variable entry includes the type field", () => {
    const result = toYamlStr(
      [],
      [PATH_VAR],
      MAKE_DIR_COMMAND,
    )
    const parsed = yaml.load(result) as Record<
      string,
      unknown
    >
    const variablesObj = parsed.variables as Record<
      string,
      { type?: string }
    >
    expect(variablesObj.basePath?.type).toBe("path")
  })

  test("variable entry includes label and value", () => {
    const result = toYamlStr(
      [],
      [PATH_VAR],
      MAKE_DIR_COMMAND,
    )
    const parsed = yaml.load(result) as Record<
      string,
      unknown
    >
    const variablesObj = parsed.variables as Record<
      string,
      { label?: string; value?: string }
    >
    expect(variablesObj.basePath?.label).toBe("Base")
    expect(variablesObj.basePath?.value).toBe("/mnt/media")
  })

  test("round-trips a threadCount variable through the unified variables block", () => {
    // Worker 28 folded threadCount into variablesAtom. The on-disk envelope
    // is still `variables: { tc: { type: "threadCount", value: "<N>" } }`,
    // but it flows through the standard `paths` array (rather than a side-
    // channel param) on both write and read.
    const threadCountVariable: Variable = {
      id: "tc",
      label: "Max threads (per job)",
      value: "4",
      type: "threadCount",
    }
    const yamlStr = toYamlStr(
      [],
      [threadCountVariable],
      MAKE_DIR_COMMAND,
    )
    expect(yamlStr).toContain("tc:")
    expect(yamlStr).toContain("type: threadCount")
    expect(yamlStr).toContain("value: '4'")

    const reloaded = loadYamlFromText(
      yamlStr,
      MAKE_DIR_COMMAND,
      [],
    )
    const threadCountReloaded = reloaded.paths.find(
      (variable) => variable.type === "threadCount",
    )
    expect(threadCountReloaded).toBeDefined()
    expect(threadCountReloaded?.id).toBe("tc")
    expect(threadCountReloaded?.value).toBe("4")
  })

  test("round-trips a dvdCompareId variable with type preserved", () => {
    const dvdCompareIdVariable: Variable = {
      id: "dvdCompareIdVariable_xyz",
      label: "Spider-Man 2002",
      value: "spider-man-2002",
      type: "dvdCompareId",
    }
    const yamlStr = toYamlStr(
      [],
      [dvdCompareIdVariable],
      MAKE_DIR_COMMAND,
    )
    const reloaded = loadYamlFromText(
      yamlStr,
      MAKE_DIR_COMMAND,
      [],
    )
    const dvdCompareIdReloaded = reloaded.paths.find(
      (variable) =>
        variable.id === "dvdCompareIdVariable_xyz",
    )
    expect(dvdCompareIdReloaded).toBeDefined()
    expect(dvdCompareIdReloaded?.type).toBe("dvdCompareId")
    expect(dvdCompareIdReloaded?.label).toBe(
      "Spider-Man 2002",
    )
    expect(dvdCompareIdReloaded?.value).toBe(
      "spider-man-2002",
    )
  })
})

// ─── toYamlStr — blank step persistence ──────────────────────────────────────
//
// Blank cards from the Builder UI are persisted in YAML so undo/redo,
// copy-yaml, and `?seq=` round-trips keep the slot. The server's
// runner treats `command: ""` as a no-op (sequenceRunner.ts).

describe("toYamlStr — blank step persistence", () => {
  test("emits blank steps (command: '') inside a group with their id intact", () => {
    const realStep = makeStep({
      id: "real-1",
      command: "makeDirectory",
    })
    const blankStep = makeStep({
      id: "blank-1",
      command: "",
    })
    const group: SequenceItem = {
      kind: "group",
      id: "group-1",
      label: "",
      isParallel: false,
      isCollapsed: false,
      steps: [realStep, blankStep],
    }

    const result = toYamlStr([group], [], MAKE_DIR_COMMAND)

    expect(result).toContain("real-1")
    expect(result).toContain("blank-1")
    expect(result).toContain("command: ''")
  })

  test("emits a standalone blank top-level step", () => {
    const blankStep = makeStep({
      id: "blank-2",
      command: "",
    })
    const realStep = makeStep({
      id: "real-2",
      command: "makeDirectory",
    })

    const result = toYamlStr(
      [blankStep, realStep] as SequenceItem[],
      [],
      MAKE_DIR_COMMAND,
    )

    expect(result).toContain("real-2")
    expect(result).toContain("blank-2")
  })

  test("a group of only blank steps still serializes (no-op slot is preserved)", () => {
    const group: SequenceItem = {
      kind: "group",
      id: "group-2",
      label: "",
      isParallel: false,
      isCollapsed: false,
      steps: [
        makeStep({ id: "blank-3", command: "" }),
        makeStep({ id: "blank-4", command: "" }),
      ],
    }

    const result = toYamlStr(
      [group],
      [
        {
          id: "basePath",
          label: "Base Path",
          value: "",
          type: "path" as const,
        },
      ],
      {},
    )

    expect(result).toContain("blank-3")
    expect(result).toContain("blank-4")
  })
})

// ─── Blank step round-trip ───────────────────────────────────────────────────

describe("blank step round-trip (toYaml → loadYaml)", () => {
  test("preserves a blank step at top level and inside a group", () => {
    const blankTop = makeStep({
      id: "blank_top",
      command: "",
    })
    const real = makeStep({
      id: "real_one",
      command: "makeDirectory",
    })
    const blankInGroup = makeStep({
      id: "blank_in_group",
      command: "",
    })
    const group = {
      kind: "group" as const,
      id: "group_g1",
      label: "",
      isParallel: false,
      isCollapsed: false,
      steps: [real, blankInGroup],
    }

    const serialized = toYamlStr(
      [blankTop, group] as SequenceItem[],
      [],
      MAKE_DIR_COMMAND,
    )
    const reloaded = loadYamlFromText(
      serialized,
      MAKE_DIR_COMMAND,
      BASE_PATHS,
    )

    const [topItem, groupItem] = reloaded.steps as [
      Step,
      { steps: Step[] },
    ]
    expect(topItem.id).toBe("blank_top")
    expect(topItem.command).toBe("")
    const innerIds = groupItem.steps.map((step) => step.id)
    expect(innerIds).toEqual(["real_one", "blank_in_group"])
    const innerCommands = groupItem.steps.map(
      (step) => step.command,
    )
    expect(innerCommands).toEqual(["makeDirectory", ""])
  })
})

// ─── loadYamlFromText — blank / placeholder steps ────────────────────────────

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

// ─── loadYamlFromText — steps with commands ───────────────────────────────────

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

  test("rejects legacy nameSpecialFeatures when target rename is also unregistered", () => {
    // FAKE_COMMANDS does not include nameSpecialFeaturesDvdCompareTmdb,
    // so the rename target itself is missing and the load must fail
    // explicitly rather than silently producing a broken step.
    const yaml = `
steps:
  - command: nameSpecialFeatures
    params: {}
`
    expect(() => load(yaml)).toThrow(
      /renamed to ["']?nameSpecialFeaturesDvdCompareTmdb["']?, but ["']?nameSpecialFeaturesDvdCompareTmdb["']? is not registered/,
    )
  })

  test("transparently shims renamed nameSpecialFeatures when target is registered", () => {
    const commandsWithRename: Commands = {
      ...FAKE_COMMANDS,
      nameSpecialFeaturesDvdCompareTmdb: {
        fields: [
          { name: "path", type: "path", isLinkable: true },
        ],
      },
    }
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {})
    try {
      const result = loadYamlFromText(
        [
          "steps:",
          "  - command: nameSpecialFeatures",
          "    params: {}",
        ].join("\n"),
        commandsWithRename,
        BASE_PATHS,
      )
      expect(result.steps).toHaveLength(1)
      const step = result.steps[0] as Step
      expect(step.command).toBe(
        "nameSpecialFeaturesDvdCompareTmdb",
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'renamed command "nameSpecialFeatures"',
        ),
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  test("emits the rename warning only once per load call", () => {
    const commandsWithRename: Commands = {
      ...FAKE_COMMANDS,
      nameSpecialFeaturesDvdCompareTmdb: {
        fields: [
          { name: "path", type: "path", isLinkable: true },
        ],
      },
    }
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {})
    try {
      loadYamlFromText(
        [
          "steps:",
          "  - command: nameSpecialFeatures",
          "    params: {}",
          "  - command: nameSpecialFeatures",
          "    params: {}",
          "  - command: nameSpecialFeatures",
          "    params: {}",
        ].join("\n"),
        commandsWithRename,
        BASE_PATHS,
      )
      const renameCalls = warnSpy.mock.calls.filter(
        ([msg]) =>
          typeof msg === "string" &&
          msg.includes(
            'renamed command "nameSpecialFeatures"',
          ),
      )
      expect(renameCalls).toHaveLength(1)
    } finally {
      warnSpy.mockRestore()
    }
  })

  test("restores path-variable links from @-prefixed values", () => {
    const paths: PathVariable[] = [
      {
        id: "basePath",
        label: "basePath",
        value: "/media",
        type: "path",
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

// ─── loadYamlFromText — path restoration ─────────────────────────────────────

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
      type: "path",
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

// ─── loadYamlFromText — groups ────────────────────────────────────────────────

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

// ─── Variable.type on loaded path variables ───────────────────────────────────

describe("Variable.type on loaded path variables", () => {
  test("legacy paths: block populates type: path on each entry", () => {
    const yamlText = `
paths:
  basePath:
    label: Base
    value: /mnt/media
steps: []
`
    const result = load(yamlText)
    const variable = result.paths[0] as Variable
    expect(variable.type).toBe("path")
  })
})

// ─── variables: block (new format) ───────────────────────────────────────────

describe("variables: block (new format)", () => {
  test("reads variables: block with explicit type field", () => {
    const yamlText = `
variables:
  basePath:
    label: Base
    value: /mnt/media
    type: path
steps:
  - id: step1
    command: makeDirectory
    params:
      path: '@basePath'
`
    const result = load(yamlText)
    expect(result.paths).toHaveLength(1)
    const variable = result.paths[0] as Variable
    expect(variable.type).toBe("path")
    expect(variable.id).toBe("basePath")
    expect(variable.value).toBe("/mnt/media")
  })

  test("variables: link resolution works with @-prefix", () => {
    const yamlText = `
variables:
  myPath:
    label: My Path
    value: /output
    type: path
steps:
  - command: makeDirectory
    params:
      path: '@myPath'
`
    const result = load(yamlText)
    const step = result.steps[0] as {
      links: Record<string, string>
    }
    expect(step.links.path).toBe("myPath")
  })

  test("variables: wins over paths: on the same id", () => {
    const yamlText = `
paths:
  basePath:
    label: Old Label
    value: /old
variables:
  basePath:
    label: New Label
    value: /new
    type: path
steps: []
`
    const result = load(yamlText)
    expect(result.paths).toHaveLength(1)
    expect(result.paths[0].value).toBe("/new")
    expect(result.paths[0].label).toBe("New Label")
  })
})

// ─── Legacy field renames (worker 24 — source path abstraction) ───────────────
// User-saved YAML templates still use the pre-rename field names. The codec
// remaps known legacy field names to their canonical replacement at read
// time and emits a one-time per-rename console.warn so the user knows their
// template is out-of-date. The write path always uses the canonical name.

describe("legacy field renames — read-time remapping", () => {
  const LEGACY_RENAME_COMMANDS: Commands = {
    getAudioOffsets: {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          isRequired: true,
          isLinkable: true,
        },
        {
          name: "destinationFilesPath",
          type: "path",
          isRequired: true,
          isLinkable: true,
        },
      ],
    },
    addSubtitles: {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          isRequired: true,
          isLinkable: true,
        },
        {
          name: "subtitlesPath",
          type: "path",
          isRequired: true,
          isLinkable: true,
        },
      ],
    },
    replaceAttachments: {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          isRequired: true,
          isLinkable: true,
        },
        {
          name: "destinationFilesPath",
          type: "path",
          isRequired: true,
          isLinkable: true,
        },
      ],
    },
    replaceTracks: {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          isRequired: true,
          isLinkable: true,
        },
        {
          name: "destinationFilesPath",
          type: "path",
          isRequired: true,
          isLinkable: true,
        },
      ],
    },
    deleteFolder: {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          isRequired: true,
          isLinkable: true,
        },
      ],
    },
    makeDirectory: {
      fields: [
        {
          name: "sourcePath",
          type: "path",
          isRequired: true,
          isLinkable: true,
        },
      ],
    },
    deleteCopiedOriginals: {
      fields: [
        {
          name: "pathsToDelete",
          type: "json",
          isRequired: true,
        },
      ],
    },
  }

  const loadWithRenameCommands = (text: string) =>
    loadYamlFromText(
      text,
      LEGACY_RENAME_COMMANDS,
      BASE_PATHS,
    )

  test.each([
    ["getAudioOffsets", "sourceFilesPath"],
    ["addSubtitles", "mediaFilesPath"],
    ["replaceAttachments", "sourceFilesPath"],
    ["replaceTracks", "sourceFilesPath"],
    ["deleteFolder", "folderPath"],
    ["makeDirectory", "filePath"],
  ])("legacy %s.%s in params remaps to sourcePath", (command, legacyField) => {
    const yamlText = `
steps:
  - command: ${command}
    params:
      ${legacyField}: /some/literal/path
`
    const result = loadWithRenameCommands(yamlText)
    const step = result.steps[0] as Step
    expect(step.params.sourcePath).toBe(
      "/some/literal/path",
    )
    expect(step.params[legacyField]).toBeUndefined()
  })

  test.each([
    ["getAudioOffsets", "sourceFilesPath"],
    ["addSubtitles", "mediaFilesPath"],
    ["replaceAttachments", "sourceFilesPath"],
    ["replaceTracks", "sourceFilesPath"],
    ["deleteFolder", "folderPath"],
    ["makeDirectory", "filePath"],
  ])("legacy %s.%s as @-link remaps to sourcePath link", (command, legacyField) => {
    const yamlText = `
steps:
  - command: ${command}
    params:
      ${legacyField}: '@basePath'
`
    const result = loadWithRenameCommands(yamlText)
    const step = result.steps[0] as Step
    expect(step.links.sourcePath).toBe("basePath")
    expect(step.links[legacyField]).toBeUndefined()
  })

  test("legacy deleteCopiedOriginals.sourcePaths remaps to pathsToDelete", () => {
    const yamlText = `
steps:
  - command: deleteCopiedOriginals
    params:
      sourcePaths:
        - /a
        - /b
`
    const result = loadWithRenameCommands(yamlText)
    const step = result.steps[0] as Step
    expect(step.params.pathsToDelete).toEqual(["/a", "/b"])
    expect(step.params.sourcePaths).toBeUndefined()
  })

  test("canonical new-name wins when both are present", () => {
    const yamlText = `
steps:
  - command: makeDirectory
    params:
      sourcePath: /winner
      filePath: /loser
`
    const result = loadWithRenameCommands(yamlText)
    const step = result.steps[0] as Step
    expect(step.params.sourcePath).toBe("/winner")
  })

  test("emits console.warn when a legacy field is remapped", () => {
    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "))
    }
    try {
      const yamlText = `
steps:
  - command: makeDirectory
    params:
      filePath: /old/style
`
      loadWithRenameCommands(yamlText)
    } finally {
      console.warn = originalWarn
    }
    expect(warnings.length).toBeGreaterThan(0)
    expect(
      warnings.some((warning) =>
        warning.includes("filePath"),
      ),
    ).toBe(true)
    expect(
      warnings.some((warning) =>
        warning.includes("sourcePath"),
      ),
    ).toBe(true)
  })
})

// ─── Legacy field renames — write path uses canonical names ───────────────────

describe("legacy field renames — write path", () => {
  test("toYamlStr writes sourcePath, never the legacy field name", () => {
    const commands: Commands = {
      addSubtitles: {
        fields: [
          {
            name: "sourcePath",
            type: "path",
            isRequired: true,
            isLinkable: true,
          },
          {
            name: "subtitlesPath",
            type: "path",
            isRequired: true,
            isLinkable: true,
          },
        ],
      },
    }
    const step = makeStep({
      id: "step-mt",
      command: "addSubtitles",
      links: {
        sourcePath: "basePath",
        subtitlesPath: "basePath",
      },
    })
    const result = toYamlStr(
      [step] as SequenceItem[],
      [BASE_PATH],
      commands,
    )
    expect(result).toContain("sourcePath: '@basePath'")
    expect(result).not.toContain("mediaFilesPath")
  })
})

// ─── Command rename chain — mergeTracks → addSubtitles ───────────────────────
// Verifies the two-stage migration: command-name shim (RENAMED_COMMANDS)
// runs first, then field-name shim (legacyFieldRenames keyed by the new
// canonical name) rewrites mediaFilesPath → sourcePath.

describe("mergeTracks → addSubtitles rename + field rename chain", () => {
  test("legacy command + legacy field migrates to canonical addSubtitles + sourcePath", () => {
    const commandsWithRename: Commands = {
      addSubtitles: {
        fields: [
          {
            name: "sourcePath",
            type: "path",
            isRequired: true,
            isLinkable: true,
          },
          {
            name: "subtitlesPath",
            type: "path",
            isRequired: true,
            isLinkable: true,
          },
        ],
      },
    }
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {})
    try {
      const yamlText = `
steps:
  - command: mergeTracks
    params:
      mediaFilesPath: /old/style
      subtitlesPath: /subs
`
      const result = loadYamlFromText(
        yamlText,
        commandsWithRename,
        BASE_PATHS,
      )
      const step = result.steps[0] as Step
      expect(step.command).toBe("addSubtitles")
      expect(step.params.sourcePath).toBe("/old/style")
      expect(step.params.mediaFilesPath).toBeUndefined()
    } finally {
      warnSpy.mockRestore()
    }
  })
})
