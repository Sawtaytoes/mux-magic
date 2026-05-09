import { z } from "zod"

import { assModificationRuleSchema } from "../api/schemas.js"
import { type SubtitleFileMetadata } from "../app-commands/getSubtitleMetadata.js"

export type SubtitleModificationRule = z.infer<typeof assModificationRuleSchema>

const IGNORED_STYLE_NAMES_REGEX_STRING = "signs?|op|ed|opening|ending"

// Heuristic rule generator: given the parsed [Script Info] + [V4+ Styles]
// metadata for every .ass file in a series, return the modifications most
// fansub releases need to play correctly in modern players (correct YCbCr
// matrix, sane vertical/horizontal margins, ScriptType bump). Mirrors the
// flow that lived in `media-sync`'s anime-subtitle pipeline; lifted here so
// the API can call it directly from the new computeDefaultSubtitleRules
// command without media-sync needing to compute rules client-side.
export const buildDefaultSubtitleModificationRules = (
  subtitlesMetadata: SubtitleFileMetadata[],
): SubtitleModificationRule[] => {
  const rules: SubtitleModificationRule[] = []

  rules.push({ type: "setScriptInfo", key: "ScriptType", value: "v4.00+" })

  const hasIncorrectColorspace = subtitlesMetadata.some(({ scriptInfo }) => (
    scriptInfo["YCbCr Matrix"] === "TV.601"
    && !(scriptInfo["PlayResX"] === "640" && scriptInfo["PlayResY"] === "480")
  ))

  if (hasIncorrectColorspace) {
    rules.push({ type: "setScriptInfo", key: "YCbCr Matrix", value: "TV.709" })
  }

  // Resolution scaling has a TODO in media-sync (didn't always work for
  // every show). Preserve that behavior by leaving the flag false here so
  // the rule generator stays a 1:1 port.
  const hasIncorrectResolution = false

  const firstScriptInfo = subtitlesMetadata[0]?.scriptInfo ?? {}
  const targetWidth = (
    hasIncorrectResolution
    ? 1920
    : (Number(firstScriptInfo["PlayResX"] ?? "1920") || 1920)
  )
  const targetHeight = (
    hasIncorrectResolution
    ? 1080
    : (Number(firstScriptInfo["PlayResY"] ?? "1080") || 1080)
  )
  const marginV = Math.round(targetHeight / 1080 * 90)
  const marginLRValue = Math.round(200 / 1920 * targetWidth)
  const marginLRThreshold = Math.round(160 / 1920 * targetWidth)

  const ignoredStyleNamesRegex = new RegExp(IGNORED_STYLE_NAMES_REGEX_STRING, "i")
  const needsMarginLR = (
    hasIncorrectResolution
    || subtitlesMetadata.some(({ styles }) => (
      styles.some((style) => (
        !ignoredStyleNamesRegex.test(style["Name"] ?? "")
        && (
          Number(style["MarginL"] ?? "0") < marginLRThreshold
          || Number(style["MarginR"] ?? "0") < marginLRThreshold
        )
      ))
    ))
  )

  const styleFields: Record<string, string> = { MarginV: String(marginV) }

  if (needsMarginLR) {
    styleFields["MarginL"] = String(marginLRValue)
    styleFields["MarginR"] = String(marginLRValue)
  }

  rules.push({
    type: "setStyleFields",
    fields: styleFields,
    ignoredStyleNamesRegexString: IGNORED_STYLE_NAMES_REGEX_STRING,
  })

  return rules
}
