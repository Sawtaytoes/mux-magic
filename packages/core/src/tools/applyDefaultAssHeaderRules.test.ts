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

test.each([
  "OPR",
  "EDTL",
  "opkara2",
  "OPv1",
  "GreatMazOPjp",
  "Credits ENG",
  "On Screen red",
  "WindariaTopSong",
])("protects compact song/credit styles %s while fixing Top dialogue", (styleName) => {
  const original = header({ width: 1920, height: 1080 })
    .replace("Style: Default,", "Style: Top,")
    .replace("Style: Signs,", `Style: ${styleName},`)
  const output = applyDefaultAssHeaderRules(original)
  expect(output).toContain(
    "Style: Top,Example Sans,60,200,200,90",
  )
  expect(output).toContain(
    `Style: ${styleName},Example Sans,48,10,10,20`,
  )
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

test("reads resolution after a repeated comment-only Script Info header and retains credits", () => {
  const original = `[Script Info]\n; First generator\n${header({ width: 768, height: 576 }).replace("ScriptType: v4.00+", "ScriptType: v4.00+\nOriginal Translation: Example Group\n; Second generator")}`
  const output = applyDefaultAssHeaderRules(original)
  expect(output).toContain(
    "Style: Default,Example Sans,60,80,80,48",
  )
  expect(output).toContain(
    "Style: Signs,Example Sans,48,10,10,20",
  )
  expect(output).toContain("YCbCr Matrix: TV.709")
  expect(output).toContain(
    "Original Translation: Example Group",
  )
  expect(output).toContain("; First generator")
  expect(output).toContain("; Second generator")
  expect(output.match(/\[Script Info\]/g)).toHaveLength(1)
})

test("refuses multiple property-bearing Script Info sections instead of choosing a resolution", () => {
  expect(() =>
    applyDefaultAssHeaderRules(
      `[Script Info]\nPlayResX: 1920\n${header({ width: 768, height: 576 })}`,
    ),
  ).toThrow(/multiple property-bearing Script Info/)
})

test("examines every style section when computing shared horizontal margins", () => {
  const original = header({ width: 1280, height: 720 })
    .replace(
      "Style: Default,Example Sans,60,10,10,20",
      "Style: Default,Example Sans,60,110,110,20",
    )
    .replace(
      "[Events]",
      "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, MarginL, MarginR, MarginV\nStyle: Note,Example Serif,30,20,20,10\n\n[Events]",
    )
  const output = applyDefaultAssHeaderRules(original)
  expect(output).toContain(
    "Style: Default,Example Sans,60,133,133,60",
  )
  expect(output).toContain(
    "Style: Note,Example Serif,30,133,133,60",
  )
  expect(output).toContain(
    "Style: Signs,Example Sans,48,10,10,20",
  )
  expect(output.match(/\[V4\+ Styles\]/g)).toHaveLength(2)
})
