import { describe, expect, test } from "vitest"

import { buildDefaultSubtitleModificationRules } from "./buildDefaultSubtitleModificationRules.js"
import { type SubtitleFileMetadata } from "../app-commands/getSubtitleMetadata.js"

const sample = (
  overrides: {
    scriptInfo?: Record<string, string>,
    styles?: Record<string, string>[],
    filePath?: string,
  } = {},
): SubtitleFileMetadata => ({
  filePath: overrides.filePath ?? "/work/episode-01.ass",
  scriptInfo: overrides.scriptInfo ?? {},
  styles: overrides.styles ?? [],
})

describe(buildDefaultSubtitleModificationRules.name, () => {
  test("always emits a setScriptInfo rule pinning ScriptType to v4.00+", () => {
    const rules = buildDefaultSubtitleModificationRules([sample()])
    expect(rules).toContainEqual({
      type: "setScriptInfo",
      key: "ScriptType",
      value: "v4.00+",
    })
  })

  test("adds a YCbCr Matrix correction when any file has TV.601 outside SD-DVD resolutions", () => {
    const rules = buildDefaultSubtitleModificationRules([
      sample({ scriptInfo: { "YCbCr Matrix": "TV.601", "PlayResX": "1920", "PlayResY": "1080" } }),
    ])
    expect(rules).toContainEqual({
      type: "setScriptInfo",
      key: "YCbCr Matrix",
      value: "TV.709",
    })
  })

  test("does not touch YCbCr Matrix on a 640x480 SD source where TV.601 is correct", () => {
    const rules = buildDefaultSubtitleModificationRules([
      sample({ scriptInfo: { "YCbCr Matrix": "TV.601", "PlayResX": "640", "PlayResY": "480" } }),
    ])
    expect(rules).not.toContainEqual(expect.objectContaining({
      type: "setScriptInfo",
      key: "YCbCr Matrix",
    }))
  })

  test("computes MarginV from PlayResY and writes it via setStyleFields with the ignored-names regex", () => {
    const rules = buildDefaultSubtitleModificationRules([
      sample({ scriptInfo: { "PlayResX": "1920", "PlayResY": "1080" } }),
    ])
    const styleRule = rules.find((rule) => rule.type === "setStyleFields")
    expect(styleRule).toMatchObject({
      type: "setStyleFields",
      // 1080/1080*90 = 90.
      fields: { MarginV: "90" },
      ignoredStyleNamesRegexString: "signs?|op|ed|opening|ending",
    })
  })

  test("scales MarginV proportionally for sub-1080p sources", () => {
    const rules = buildDefaultSubtitleModificationRules([
      // 720/1080*90 = 60.
      sample({ scriptInfo: { "PlayResX": "1280", "PlayResY": "720" } }),
    ])
    const styleRule = rules.find((rule) => rule.type === "setStyleFields")
    expect(styleRule).toMatchObject({
      type: "setStyleFields",
      fields: { MarginV: "60" },
    })
  })

  test("adds horizontal margins when any non-ignored style has MarginL/R below the threshold", () => {
    const rules = buildDefaultSubtitleModificationRules([
      sample({
        scriptInfo: { "PlayResX": "1920", "PlayResY": "1080" },
        styles: [
          { Name: "Default", MarginL: "0", MarginR: "0" },
        ],
      }),
    ])
    const styleRule = rules.find((rule) => rule.type === "setStyleFields")
    expect(styleRule).toMatchObject({
      type: "setStyleFields",
      fields: {
        // 200/1920*1920 = 200.
        MarginL: "200",
        MarginR: "200",
        MarginV: "90",
      },
    })
  })

  test("ignores narrow-margin styles whose Name matches the ignored-styles regex (sign/song)", () => {
    const rules = buildDefaultSubtitleModificationRules([
      sample({
        scriptInfo: { "PlayResX": "1920", "PlayResY": "1080" },
        styles: [
          // The narrow margin here would normally trigger an MarginL/R rule,
          // but "Signs" matches the ignored-name regex so it shouldn't count.
          { Name: "Signs", MarginL: "0", MarginR: "0" },
        ],
      }),
    ])
    const styleRule = rules.find((rule) => rule.type === "setStyleFields")
    expect(styleRule?.fields).not.toHaveProperty("MarginL")
    expect(styleRule?.fields).not.toHaveProperty("MarginR")
  })

  test("treats missing PlayResX/Y as 1920x1080 defaults", () => {
    const rules = buildDefaultSubtitleModificationRules([sample({ scriptInfo: {} })])
    const styleRule = rules.find((rule) => rule.type === "setStyleFields")
    expect(styleRule).toMatchObject({
      type: "setStyleFields",
      fields: { MarginV: "90" },
    })
  })

  test("returns a usable rule set even when given an empty metadata array", () => {
    const rules = buildDefaultSubtitleModificationRules([])
    expect(rules.length).toBeGreaterThan(0)
    expect(rules[0]).toEqual({
      type: "setScriptInfo",
      key: "ScriptType",
      value: "v4.00+",
    })
  })
})
