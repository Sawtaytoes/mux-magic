import { describe, expect, it } from "vitest"
import { FIXTURE_COMMANDS_BUNDLE_A } from "../commands/__fixtures__/commands"
import { makeFakeJob } from "./__fixtures__/makeFakeJob"
import { buildBuilderUrl } from "./buildBuilderUrl"
import { decodeSeqParam } from "./decodeSeqParam"
import { loadYamlFromText } from "./yamlCodec"

// Round-trip: buildBuilderUrl → decodeSeqParam → loadYamlFromText
// Verifies that the ?seq= URL format is stable across encode+decode.

const DEFAULT_PATHS = [
  {
    id: "basePath",
    label: "basePath",
    value: "",
    type: "path" as const,
  },
]

describe("buildBuilderUrl round-trip", () => {
  it("produces a /builder?seq= URL for a single-command job", () => {
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
    expect(url).toMatch(/^\/builder\?seq=/)
  })

  it("round-trips a single-command job through encode → decode → parse", () => {
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
    const b64 = new URLSearchParams(url.split("?")[1]).get(
      "seq",
    )
    const decoded = decodeSeqParam(b64)

    if (!decoded)
      throw new Error("decodeSeqParam returned null")

    const result = loadYamlFromText(
      decoded,
      FIXTURE_COMMANDS_BUNDLE_A,
      DEFAULT_PATHS,
      0,
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

  it("round-trips a sequence job (commandName === 'sequence') preserving all steps", () => {
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
    const b64 = new URLSearchParams(url.split("?")[1]).get(
      "seq",
    )
    const decoded = decodeSeqParam(b64)

    if (!decoded)
      throw new Error("decodeSeqParam returned null")

    const result = loadYamlFromText(
      decoded,
      FIXTURE_COMMANDS_BUNDLE_A,
      DEFAULT_PATHS,
      0,
    )

    expect(result.steps).toHaveLength(2)
    expect(
      (result.steps[0] as { command: string }).command,
    ).toBe("flattenOutput")
    expect(
      (result.steps[1] as { command: string }).command,
    ).toBe("setDisplayWidth")
  })

  it("decodeSeqParam returns null for malformed base64", () => {
    expect(decodeSeqParam("not-valid-base64!!!")).toBeNull()
  })

  it("decodeSeqParam returns null for empty input", () => {
    expect(decodeSeqParam(null)).toBeNull()
    expect(decodeSeqParam("")).toBeNull()
  })
})
