import { describe, expect, test } from "vitest"
import {
  applyAssRules,
  buildFileMetadata,
  evaluateApplyIfPredicate,
  evaluateWhenPredicate,
  type FileBatchMetadata,
  filterRulesByWhen,
} from "./applyAssRules.js"
import {
  parseAssFile,
  serializeAssFile,
} from "./assFileTools.js"
import type { AssModificationRule } from "./assTypes.js"

const SAMPLE_HD = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontsize, MarginL, MarginR, MarginV
Style: Default,60,10,10,20
Style: Signs,48,10,10,20

[Events]
Format: Layer, Start, End, Style, Name, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,Hello
`

const SAMPLE_SD_DVD = `[Script Info]
ScriptType: v4.00+
PlayResX: 640
PlayResY: 480
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontsize, MarginL, MarginR, MarginV
Style: Default,24,10,10,18

[Events]
Format: Layer, Start, End, Style, Name, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,Hello
`

const SAMPLE_720P_NARROW = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontsize, MarginL, MarginR, MarginV
Style: Default,40,5,5,15

[Events]
Format: Layer, Start, End, Style, Name, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,Hello
`

const buildBatchMetadata = (
  samples: string[],
): FileBatchMetadata[] =>
  samples.map((content, index) => {
    const assFile = parseAssFile(content)
    return buildFileMetadata({
      assFile,
      filePath: `/work/file${index}.ass`,
    })
  })

describe("evaluateWhenPredicate (G1)", () => {
  test("anyScriptInfo shorthand matches when at least one file has the key/value", () => {
    const batchMetadata = buildBatchMetadata([
      SAMPLE_HD,
      SAMPLE_SD_DVD,
    ])
    const isResult = evaluateWhenPredicate({
      batchMetadata,
      predicate: {
        anyScriptInfo: { "YCbCr Matrix": "TV.601" },
      },
      predicates: {},
    })
    expect(isResult).toBe(true)
  })

  test("anyScriptInfo shorthand returns false when no file matches", () => {
    const batchMetadata = buildBatchMetadata([
      SAMPLE_720P_NARROW,
    ])
    const isResult = evaluateWhenPredicate({
      batchMetadata,
      predicate: {
        anyScriptInfo: { "YCbCr Matrix": "TV.601" },
      },
      predicates: {},
    })
    expect(isResult).toBe(false)
  })

  test("excludes block rejects per-file matches that satisfy the negation set", () => {
    // Both files have TV.601, but SD-DVD also has 640x480. With excludes:
    // 640x480, only the HD file should satisfy the per-file clause.
    const batchMetadata = buildBatchMetadata([
      SAMPLE_SD_DVD,
    ])
    const isResult = evaluateWhenPredicate({
      batchMetadata,
      predicate: {
        anyScriptInfo: {
          matches: { "YCbCr Matrix": "TV.601" },
          excludes: { PlayResX: "640", PlayResY: "480" },
        },
      },
      predicates: {},
    })
    expect(isResult).toBe(false)
  })

  test("excludes still passes per-file when the file does NOT match the negation set together", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const isResult = evaluateWhenPredicate({
      batchMetadata,
      predicate: {
        anyScriptInfo: {
          matches: { "YCbCr Matrix": "TV.601" },
          excludes: { PlayResX: "640", PlayResY: "480" },
        },
      },
      predicates: {},
    })
    expect(isResult).toBe(true)
  })

  test("$ref resolves named predicate from the predicates map (SD-DVD carve-out)", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const isResult = evaluateWhenPredicate({
      batchMetadata,
      predicate: {
        anyScriptInfo: {
          matches: { "YCbCr Matrix": "TV.601" },
          excludes: { $ref: "isSdDvd" },
        },
      },
      predicates: {
        isSdDvd: {
          "YCbCr Matrix": "TV.601",
          PlayResX: "640",
          PlayResY: "480",
        },
      },
    })
    expect(isResult).toBe(true)
  })

  test("unknown $ref throws a descriptive error", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    expect(() =>
      evaluateWhenPredicate({
        batchMetadata,
        predicate: {
          anyScriptInfo: { matches: { $ref: "nope" } },
        },
        predicates: {},
      }),
    ).toThrow(/nope/)
  })

  test("noneScriptInfo returns true when no file matches", () => {
    const batchMetadata = buildBatchMetadata([
      SAMPLE_HD,
      SAMPLE_720P_NARROW,
    ])
    const isResult = evaluateWhenPredicate({
      batchMetadata,
      predicate: { noneScriptInfo: { PlayResX: "640" } },
      predicates: {},
    })
    expect(isResult).toBe(true)
  })

  test("notAllScriptInfo returns true when at least one file does not satisfy the clause", () => {
    const batchMetadata = buildBatchMetadata([
      SAMPLE_HD,
      SAMPLE_SD_DVD,
    ])
    const isResult = evaluateWhenPredicate({
      batchMetadata,
      predicate: { notAllScriptInfo: { PlayResX: "1920" } },
      predicates: {},
    })
    expect(isResult).toBe(true)
  })

  test("anyStyle aggregates over flattened style rows across all files", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const isResult = evaluateWhenPredicate({
      batchMetadata,
      predicate: { anyStyle: { Name: "Signs" } },
      predicates: {},
    })
    expect(isResult).toBe(true)
  })

  test("multiple clauses are ANDed together", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const isResult = evaluateWhenPredicate({
      batchMetadata,
      predicate: {
        anyScriptInfo: { "YCbCr Matrix": "TV.601" },
        noneScriptInfo: { PlayResX: "640" },
      },
      predicates: {},
    })
    expect(isResult).toBe(true)
  })
})

describe("filterRulesByWhen (G1)", () => {
  test("rules without when: always pass; rules with failing when: are dropped", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const rules: AssModificationRule[] = [
      {
        type: "setScriptInfo",
        key: "ScriptType",
        value: "v4.00+",
      },
      {
        type: "setScriptInfo",
        key: "PlayResX",
        value: "1280",
        when: { anyScriptInfo: { PlayResX: "640" } },
      },
    ]
    const filtered = filterRulesByWhen({
      batchMetadata,
      predicates: {},
      rules,
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toMatchObject({ key: "ScriptType" })
  })
})

describe("evaluateApplyIfPredicate (G3)", () => {
  test("anyStyleMatches with lt comparator passes when at least one row qualifies", () => {
    const batchMetadata = buildBatchMetadata([
      SAMPLE_720P_NARROW,
    ])
    const isResult = evaluateApplyIfPredicate({
      applyIf: { anyStyleMatches: { MarginL: { lt: 50 } } },
      fileMetadata:
        batchMetadata.at(0) ??
        (() => {
          throw new Error("no metadata")
        })(),
    })
    expect(isResult).toBe(true)
  })

  test("anyStyleMatches fails when no row qualifies", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const isResult = evaluateApplyIfPredicate({
      applyIf: {
        anyStyleMatches: { MarginL: { gt: 1000 } },
      },
      fileMetadata:
        batchMetadata.at(0) ??
        (() => {
          throw new Error("no metadata")
        })(),
    })
    expect(isResult).toBe(false)
  })

  test("eq comparator matches numeric equality", () => {
    const batchMetadata = buildBatchMetadata([
      SAMPLE_720P_NARROW,
    ])
    const isResult = evaluateApplyIfPredicate({
      applyIf: { anyStyleMatches: { MarginV: { eq: 15 } } },
      fileMetadata:
        batchMetadata.at(0) ??
        (() => {
          throw new Error("no metadata")
        })(),
    })
    expect(isResult).toBe(true)
  })

  test("string equality entry matches exact field value", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const isResult = evaluateApplyIfPredicate({
      applyIf: { anyStyleMatches: { Name: "Signs" } },
      fileMetadata:
        batchMetadata.at(0) ??
        (() => {
          throw new Error("no metadata")
        })(),
    })
    expect(isResult).toBe(true)
  })

  test("noneStyleMatches succeeds when no row matches", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const isResult = evaluateApplyIfPredicate({
      applyIf: {
        noneStyleMatches: { Name: "DoesNotExist" },
      },
      fileMetadata:
        batchMetadata.at(0) ??
        (() => {
          throw new Error("no metadata")
        })(),
    })
    expect(isResult).toBe(true)
  })

  test("setStyleFields skips files where applyIf rejects", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const assFile = parseAssFile(SAMPLE_HD)
    const result = applyAssRules({
      assFile,
      fileMetadata: batchMetadata[0],
      rules: [
        {
          type: "setStyleFields",
          fields: { MarginL: "200" },
          applyIf: {
            anyStyleMatches: { MarginL: { lt: 5 } },
          },
        },
      ],
    })
    const stylesSection = result.sections.find(
      (section) => section.sectionName === "V4+ Styles",
    )
    if (stylesSection?.sectionType !== "formatted") {
      throw new Error("expected formatted styles section")
    }
    const defaultStyle = stylesSection.entries.find(
      (entry) =>
        entry.entryType === "Style" &&
        entry.fields.Name === "Default",
    )
    expect(defaultStyle?.fields.MarginL).toBe("10")
  })
})

describe("computeFrom (G2)", () => {
  test("MarginV computed from PlayResY ratio for 1080p resolves to 90", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const assFile = parseAssFile(SAMPLE_HD)
    const result = applyAssRules({
      assFile,
      fileMetadata: batchMetadata[0],
      rules: [
        {
          type: "setStyleFields",
          fields: {
            MarginV: {
              computeFrom: {
                property: "PlayResY",
                scope: "scriptInfo",
                ops: [
                  { divide: 1080 },
                  { multiply: 90 },
                  "round",
                ],
              },
            },
          },
        },
      ],
    })
    const stylesSection = result.sections.find(
      (section) => section.sectionName === "V4+ Styles",
    )
    if (stylesSection?.sectionType !== "formatted") {
      throw new Error("expected formatted styles section")
    }
    const defaultStyle = stylesSection.entries.find(
      (entry) =>
        entry.entryType === "Style" &&
        entry.fields.Name === "Default",
    )
    expect(defaultStyle?.fields.MarginV).toBe("90")
  })

  test("MarginV from 720p resolves to 60 (rounded)", () => {
    const batchMetadata = buildBatchMetadata([
      SAMPLE_720P_NARROW,
    ])
    const assFile = parseAssFile(SAMPLE_720P_NARROW)
    const result = applyAssRules({
      assFile,
      fileMetadata: batchMetadata[0],
      rules: [
        {
          type: "setStyleFields",
          fields: {
            MarginV: {
              computeFrom: {
                property: "PlayResY",
                scope: "scriptInfo",
                ops: [
                  { divide: 1080 },
                  { multiply: 90 },
                  "round",
                ],
              },
            },
          },
        },
      ],
    })
    const stylesSection = result.sections.find(
      (section) => section.sectionName === "V4+ Styles",
    )
    if (stylesSection?.sectionType !== "formatted") {
      throw new Error("expected formatted styles section")
    }
    const defaultStyle = stylesSection.entries.find(
      (entry) =>
        entry.entryType === "Style" &&
        entry.fields.Name === "Default",
    )
    expect(defaultStyle?.fields.MarginV).toBe("60")
  })

  test("scope: style reads the per-row value, allowing per-style transforms", () => {
    const batchMetadata = buildBatchMetadata([
      SAMPLE_720P_NARROW,
    ])
    const assFile = parseAssFile(SAMPLE_720P_NARROW)
    const result = applyAssRules({
      assFile,
      fileMetadata: batchMetadata[0],
      rules: [
        {
          type: "setStyleFields",
          fields: {
            MarginL: {
              computeFrom: {
                property: "MarginL",
                scope: "style",
                // Default's MarginL is 5 → +10 = 15.
                ops: [{ add: 10 }],
              },
            },
          },
        },
      ],
    })
    const stylesSection = result.sections.find(
      (section) => section.sectionName === "V4+ Styles",
    )
    if (stylesSection?.sectionType !== "formatted") {
      throw new Error("expected formatted styles section")
    }
    const defaultStyle = stylesSection.entries.find(
      (entry) =>
        entry.entryType === "Style" &&
        entry.fields.Name === "Default",
    )
    expect(defaultStyle?.fields.MarginL).toBe("15")
  })

  test("ops chain applies left-to-right", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const assFile = parseAssFile(SAMPLE_HD)
    // PlayResY=1080. (1080+20)/2=550, then floor → 550, then min(100) → 100.
    const result = applyAssRules({
      assFile,
      fileMetadata: batchMetadata[0],
      rules: [
        {
          type: "setStyleFields",
          fields: {
            MarginV: {
              computeFrom: {
                property: "PlayResY",
                scope: "scriptInfo",
                ops: [
                  { add: 20 },
                  { divide: 2 },
                  "floor",
                  { min: 100 },
                ],
              },
            },
          },
        },
      ],
    })
    const stylesSection = result.sections.find(
      (section) => section.sectionName === "V4+ Styles",
    )
    if (stylesSection?.sectionType !== "formatted") {
      throw new Error("expected formatted styles section")
    }
    const defaultStyle = stylesSection.entries.find(
      (entry) =>
        entry.entryType === "Style" &&
        entry.fields.Name === "Default",
    )
    expect(defaultStyle?.fields.MarginV).toBe("100")
  })

  test("ceil and abs ops work as no-arg bare strings", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const assFile = parseAssFile(SAMPLE_HD)
    // PlayResY=1080. - 1090 = -10; abs → 10; ceil → 10.
    const result = applyAssRules({
      assFile,
      fileMetadata: batchMetadata[0],
      rules: [
        {
          type: "setStyleFields",
          fields: {
            MarginV: {
              computeFrom: {
                property: "PlayResY",
                scope: "scriptInfo",
                ops: [{ subtract: 1090 }, "abs", "ceil"],
              },
            },
          },
        },
      ],
    })
    const stylesSection = result.sections.find(
      (section) => section.sectionName === "V4+ Styles",
    )
    if (stylesSection?.sectionType !== "formatted") {
      throw new Error("expected formatted styles section")
    }
    const defaultStyle = stylesSection.entries.find(
      (entry) =>
        entry.entryType === "Style" &&
        entry.fields.Name === "Default",
    )
    expect(defaultStyle?.fields.MarginV).toBe("10")
  })

  test("string literal field values still pass through unchanged", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const assFile = parseAssFile(SAMPLE_HD)
    const result = applyAssRules({
      assFile,
      fileMetadata: batchMetadata[0],
      rules: [
        {
          type: "setStyleFields",
          fields: { MarginV: "100" },
        },
      ],
    })
    const serialized = serializeAssFile(result)
    expect(serialized).toContain(
      "Style: Default,60,10,10,100",
    )
    expect(serialized).toContain(
      "Style: Signs,48,10,10,100",
    )
  })
})

describe("when: + applyIf + computeFrom interact correctly through applyAssRules", () => {
  test("rule that fails when: is filtered out before per-file iteration", () => {
    const batchMetadata = buildBatchMetadata([SAMPLE_HD])
    const rules: AssModificationRule[] = [
      {
        type: "setScriptInfo",
        key: "ScriptType",
        value: "broken-by-when",
        when: { anyScriptInfo: { PlayResX: "640" } },
      },
    ]
    const filtered = filterRulesByWhen({
      batchMetadata,
      predicates: {},
      rules,
    })
    expect(filtered).toEqual([])
  })
})
