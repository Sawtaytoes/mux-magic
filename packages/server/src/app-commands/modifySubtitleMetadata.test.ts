import { readFile } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { captureConsoleMessage } from "../tools/captureConsoleMessage.js"
import { modifySubtitleMetadata } from "./modifySubtitleMetadata.js"

const MINIMAL_ASS = `[Script Info]
ScriptType: v4.00
Title: Test
`

const HD_TV601_ASS = `[Script Info]
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

describe(modifySubtitleMetadata.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "/work/episode-01.ass": MINIMAL_ASS,
    })
  })

  test("returns EMPTY without touching files when rules is an empty array", async () => (
    captureConsoleMessage("info", async () => {
      const emissions = await firstValueFrom(
        modifySubtitleMetadata({
          isRecursive: false,
          rules: [],
          sourcePath: "/work",
        })
        .pipe(toArray()),
      )
      expect(emissions).toEqual([])

      // The .ass file content stays exactly as seeded — no parse/serialize
      // round-trip, no formatting drift.
      const after = await readFile("/work/episode-01.ass", "utf8")
      expect(after).toBe(MINIMAL_ASS)
    })
  ))

  test("returns EMPTY when rules is nullish (defensive guard)", async () => (
    captureConsoleMessage("info", async () => {
      const emissions = await firstValueFrom(
        modifySubtitleMetadata({
          isRecursive: false,
          // @ts-expect-error — defensive: external callers might omit it.
          rules: undefined,
          sourcePath: "/work",
        })
        .pipe(toArray()),
      )
      expect(emissions).toEqual([])
    })
  ))

  test("emits a { filePath } record per modified file so job.results is useful, not [null, null, …]", async () => (
    captureConsoleMessage("info", async () => {
      vol.fromJSON({
        "/work/episode-02.ass": MINIMAL_ASS,
      })

      const emissions = await firstValueFrom(
        modifySubtitleMetadata({
          isRecursive: false,
          rules: [{ type: "setScriptInfo", key: "ScriptType", value: "v4.00+" }],
          sourcePath: "/work",
        })
        .pipe(toArray()),
      )

      // One record per .ass file in the directory (episode-01 from the
      // outer beforeEach + episode-02 from above), not nulls.
      expect(emissions).toEqual(expect.arrayContaining([
        { filePath: "/work/episode-01.ass" },
        { filePath: "/work/episode-02.ass" },
      ]))
      expect(emissions).toHaveLength(2)
    })
  ))

  test("hasDefaultRules:true prepends the heuristic rules and bumps ScriptType end-to-end", async () => (
    captureConsoleMessage("info", async () => {
      vol.fromJSON({
        "/work/episode-01.ass": HD_TV601_ASS,
      })

      await firstValueFrom(
        modifySubtitleMetadata({
          hasDefaultRules: true,
          isRecursive: false,
          rules: [],
          sourcePath: "/work",
        })
        .pipe(toArray()),
      )

      const after = await readFile("/work/episode-01.ass", "utf8")
      // Heuristic always pins ScriptType (no-op here since it's already
      // v4.00+) AND fixes the YCbCr Matrix to TV.709 because the file is
      // TV.601 outside the SD-DVD 640x480 carve-out.
      expect(after).toContain("YCbCr Matrix: TV.709")
      // Default style: MarginV becomes round(1080/1080*90)=90; the
      // narrow MarginL/R (10 < 160 threshold for 1920) trip the
      // heuristic's MarginL/R fix to 200 each.
      expect(after).toContain("Style: Default,60,200,200,90")
      // Signs style is protected by the ignored-names regex
      // (signs?|op|ed|opening|ending), so its margins stay untouched.
      expect(after).toContain("Style: Signs,48,10,10,20")
    })
  ))

  test("hasDefaultRules:true with user rules — user rules run AFTER and override defaults", async () => (
    captureConsoleMessage("info", async () => {
      vol.fromJSON({
        "/work/episode-01.ass": HD_TV601_ASS,
      })

      await firstValueFrom(
        modifySubtitleMetadata({
          hasDefaultRules: true,
          isRecursive: false,
          rules: [
            // User override pins MarginV to 100 — runs after the default
            // MarginV=90 rule, so 100 wins on the Default style.
            { type: "setStyleFields", fields: { MarginV: "100" } },
          ],
          sourcePath: "/work",
        })
        .pipe(toArray()),
      )

      const after = await readFile("/work/episode-01.ass", "utf8")
      // Default's MarginV is 100 (user override), MarginL/R stayed 200
      // (default rule). Signs' MarginV is also 100 because the user
      // rule has no ignored-names regex.
      expect(after).toContain("Style: Default,60,200,200,100")
      expect(after).toContain("Style: Signs,48,10,10,100")
    })
  ))

  test("user rule with when: predicate is dropped when the aggregate batch fails the predicate", async () => (
    captureConsoleMessage("info", async () => {
      vol.fromJSON({
        "/work/episode-01.ass": HD_TV601_ASS,
      })

      await firstValueFrom(
        modifySubtitleMetadata({
          isRecursive: false,
          rules: [
            // No file has 640x480, so this rule should be filtered out
            // before any file is touched.
            {
              type: "setScriptInfo",
              key: "Title",
              value: "ShouldNotAppear",
              when: { anyScriptInfo: { PlayResX: "640", PlayResY: "480" } },
            },
          ],
          sourcePath: "/work",
        })
        .pipe(toArray()),
      )

      const after = await readFile("/work/episode-01.ass", "utf8")
      expect(after).not.toContain("Title: ShouldNotAppear")
    })
  ))

  test("user rule with $ref to a named predicate resolves correctly through the orchestrator", async () => (
    captureConsoleMessage("info", async () => {
      vol.fromJSON({
        "/work/episode-01.ass": HD_TV601_ASS,
      })

      await firstValueFrom(
        modifySubtitleMetadata({
          isRecursive: false,
          predicates: {
            isSdDvd: { "YCbCr Matrix": "TV.601", PlayResX: "640", PlayResY: "480" },
          },
          rules: [
            {
              type: "setScriptInfo",
              key: "YCbCr Matrix",
              value: "TV.709",
              when: {
                anyScriptInfo: {
                  matches: { "YCbCr Matrix": "TV.601" },
                  excludes: { $ref: "isSdDvd" },
                },
              },
            },
          ],
          sourcePath: "/work",
        })
        .pipe(toArray()),
      )

      const after = await readFile("/work/episode-01.ass", "utf8")
      expect(after).toContain("YCbCr Matrix: TV.709")
    })
  ))
})
