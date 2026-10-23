import { expect, test } from "vitest"
import { applyDefaultAssHeaderRules } from "./applyDefaultAssHeaderRules.js"

const header = ({
  width,
  height,
}: {
  width: number
  height: number
}) => `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, MarginL, MarginR, MarginV
Style: Default,Example Sans,60,10,10,20
Style: Signs,Example Sans,48,10,10,20

[Events]
Format: Layer, Start, End, Style, Name, Text
`

test("uses the existing 1080p defaults and protects sign styles", () => {
  const output = applyDefaultAssHeaderRules(
    header({ width: 1920, height: 1080 }),
  )
  expect(output).toContain(
    "Style: Default,Example Sans,60,200,200,90",
  )
  expect(output).toContain(
    "Style: Signs,Example Sans,48,10,10,20",
  )
  expect(output).toContain("YCbCr Matrix: TV.709")
})

test("computes each script's own resolution and keeps the SD matrix exception", () => {
  const output = applyDefaultAssHeaderRules(
    header({ width: 640, height: 480 }),
  )
  expect(output).toContain(
    "Style: Default,Example Sans,60,67,67,40",
  )
  expect(output).toContain("YCbCr Matrix: TV.601")
})

test("refuses malformed headers instead of manufacturing subtitle styles", () => {
  expect(() =>
    applyDefaultAssHeaderRules(
      "[Script Info]\nScriptType: v4.00+\n",
    ),
  ).toThrow(/no parsed styles/)
})

test("refuses a serializer round-trip that would lose nonstandard source credit fields", () => {
  const original = header({
    width: 1920,
    height: 1080,
  }).replace(
    "ScriptType: v4.00+",
    "ScriptType: v4.00+\nOriginal Translation:Example Group",
  )
  expect(() =>
    applyDefaultAssHeaderRules(original),
  ).toThrow(/preserve all source Script Info/)
})
