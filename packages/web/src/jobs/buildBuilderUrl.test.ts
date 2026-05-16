import { describe, expect, test } from "vitest"

import { FIXTURE_COMMANDS_BUNDLE_A } from "../commands/__fixtures__/commands"
import { makeFakeJob } from "./__fixtures__/makeFakeJob"
import { buildBuilderUrl } from "./buildBuilderUrl"
import { decodeSeqJsonParam } from "./decodeSeqJsonParam"
import { decodeSeqParam } from "./decodeSeqParam"
import { encodeSeqParam } from "./encodeSeqParam"
import { loadYamlFromText } from "./yamlCodec"

// Round-trip: buildBuilderUrl → decodeSeqJsonParam → loadYamlFromText
// Verifies that the new ?seqJson= URL format is stable across encode+decode,
// and that the legacy ?seq= path still decodes for old shareable URLs.

const DEFAULT_PATHS = [
  {
    id: "basePath",
    label: "basePath",
    value: "",
    type: "path" as const,
  },
]

describe("buildBuilderUrl round-trip (?seqJson=)", () => {
  test("produces a /builder?seqJson= URL for a single-command job", () => {
    const job = makeFakeJob({
      id: "j1",
      commandName: "flattenOutput",
      status: "completed",
      params: {
        sourcePath: "/media/movies",
        deleteSourceFolder: true,
      },
    })

    const url = buildBuilderUrl(job)
    expect(url).toMatch(/^\/builder\?seqJson=/)
  })

  test("round-trips a single-command job through encode → decode → parse", () => {
    const job = makeFakeJob({
      id: "j1",
      commandName: "flattenOutput",
      status: "completed",
      params: {
        sourcePath: "/media/movies",
        deleteSourceFolder: true,
      },
    })

    const url = buildBuilderUrl(job)
    const seqJson = new URLSearchParams(
      url.split("?")[1],
    ).get("seqJson")
    const decoded = decodeSeqJsonParam(seqJson)

    if (!decoded)
      throw new Error("decodeSeqJsonParam returned null")

    const result = loadYamlFromText(
      decoded,
      FIXTURE_COMMANDS_BUNDLE_A,
      DEFAULT_PATHS,
    )

    expect(result.steps).toHaveLength(1)
    const step = result.steps[0]
    expect("command" in step).toBe(true)
    expect((step as { command: string }).command).toBe(
      "flattenOutput",
    )
    expect(
      (step as { params: Record<string, unknown> }).params
        .sourcePath,
    ).toBe("/media/movies")
    expect(
      (step as { params: Record<string, unknown> }).params
        .deleteSourceFolder,
    ).toBe(true)
  })

  test("round-trips a sequence job (commandName === 'sequence') preserving all steps", () => {
    const job = makeFakeJob({
      id: "j2",
      commandName: "sequence",
      status: "completed",
      params: {
        paths: {
          basePath: { label: "basePath", value: "/media" },
        },
        steps: [
          {
            id: "step1",
            command: "flattenOutput",
            params: { sourcePath: "@basePath" },
          },
          {
            id: "step2",
            command: "setDisplayWidth",
            params: {
              sourcePath: "@basePath",
              displayWidth: 1920,
            },
          },
        ],
      },
    })

    const url = buildBuilderUrl(job)
    const seqJson = new URLSearchParams(
      url.split("?")[1],
    ).get("seqJson")
    const decoded = decodeSeqJsonParam(seqJson)

    if (!decoded)
      throw new Error("decodeSeqJsonParam returned null")

    const result = loadYamlFromText(
      decoded,
      FIXTURE_COMMANDS_BUNDLE_A,
      DEFAULT_PATHS,
    )

    expect(result.steps).toHaveLength(2)
    expect(
      (result.steps[0] as { command: string }).command,
    ).toBe("flattenOutput")
    expect(
      (result.steps[1] as { command: string }).command,
    ).toBe("setDisplayWidth")
  })

  test("round-trips a sequence containing a blank placeholder step through ?seqJson=", () => {
    const job = makeFakeJob({
      id: "j3",
      commandName: "sequence",
      status: "completed",
      params: {
        paths: {
          basePath: { label: "basePath", value: "/media" },
        },
        steps: [
          { id: "blank_pad", command: "" },
          {
            id: "real",
            command: "flattenOutput",
            params: { sourcePath: "@basePath" },
          },
        ],
      },
    })

    const url = buildBuilderUrl(job)
    const seqJson = new URLSearchParams(
      url.split("?")[1],
    ).get("seqJson")
    const decoded = decodeSeqJsonParam(seqJson)
    if (!decoded)
      throw new Error("decodeSeqJsonParam returned null")

    const result = loadYamlFromText(
      decoded,
      FIXTURE_COMMANDS_BUNDLE_A,
      DEFAULT_PATHS,
    )

    expect(result.steps).toHaveLength(2)
    expect(
      (result.steps[0] as { id: string; command: string })
        .command,
    ).toBe("")
    expect((result.steps[0] as { id: string }).id).toBe(
      "blank_pad",
    )
    expect(
      (result.steps[1] as { command: string }).command,
    ).toBe("flattenOutput")
  })
})

describe("legacy ?seq= compatibility", () => {
  test("a hand-constructed legacy ?seq= URL still decodes via decodeSeqParam → loadYamlFromText", () => {
    // Pin the contract that the BuilderPage reader fall-back relies on: any
    // URL produced by the pre-worker-43 writer (YAML or JSON payload, base64
    // with `+`/`/`/`=`) must keep loading via the legacy decoder.
    const legacyYaml = [
      "variables:",
      "  basePath:",
      "    label: basePath",
      "    value: /media",
      "    type: path",
      "steps:",
      "  - id: step1",
      "    command: flattenOutput",
      "    params:",
      "      sourcePath: '@basePath'",
      "",
    ].join("\n")
    const legacySeq = encodeSeqParam(legacyYaml)
    const decoded = decodeSeqParam(legacySeq)

    if (!decoded)
      throw new Error("decodeSeqParam returned null")

    const result = loadYamlFromText(
      decoded,
      FIXTURE_COMMANDS_BUNDLE_A,
      DEFAULT_PATHS,
    )

    expect(result.steps).toHaveLength(1)
    expect(
      (result.steps[0] as { command: string }).command,
    ).toBe("flattenOutput")
    expect(
      result.paths.find(
        (variable) => variable.id === "basePath",
      )?.value,
    ).toBe("/media")
  })
})
