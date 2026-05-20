import { join } from "node:path"
import { describe, expect, test, vi } from "vitest"
import { resolveCueAudioFile } from "./resolveCueAudioFile.js"

vi.mock("@mux-magic/tools", async () => {
  const actual =
    await vi.importActual<typeof import("@mux-magic/tools")>(
      "@mux-magic/tools",
    )
  return {
    ...actual,
    logInfo: vi.fn(),
  }
})

const { logInfo } = await import("@mux-magic/tools")

describe(resolveCueAudioFile.name, () => {
  test("returns ok when the CUE's FILE hint matches an entry in the directory", () => {
    const result = resolveCueAudioFile({
      cuePath: "/music/Album/Album.cue",
      audioFileHint: "Album.flac",
      dirEntries: ["Album.cue", "Album.flac"],
    })
    expect(result).toEqual({
      kind: "ok",
      path: join("/music/Album", "Album.flac"),
    })
  })

  test("substitutes a lone lossless audio file when the hint is missing and logs the substitution", () => {
    vi.mocked(logInfo).mockClear()
    const result = resolveCueAudioFile({
      cuePath: "/music/Album/Album.cue",
      audioFileHint: null,
      dirEntries: ["Album.cue", "Album.flac"],
    })
    expect(result).toEqual({
      kind: "ok",
      path: join("/music/Album", "Album.flac"),
    })
    expect(logInfo).toHaveBeenCalled()
  })

  test("substitutes a lone lossless audio file when the hint does not match anything in the directory", () => {
    vi.mocked(logInfo).mockClear()
    const result = resolveCueAudioFile({
      cuePath: "/music/Album/Album.cue",
      audioFileHint: "Renamed.wav",
      dirEntries: ["Album.cue", "Album.flac"],
    })
    expect(result.kind).toBe("ok")
    if (result.kind !== "ok") return
    expect(result.path).toBe(join("/music/Album", "Album.flac"))
    expect(logInfo).toHaveBeenCalled()
  })

  test("returns error when no lossless audio is in the directory", () => {
    const result = resolveCueAudioFile({
      cuePath: "/music/Album/Album.cue",
      audioFileHint: null,
      dirEntries: ["Album.cue", "cover.jpg"],
    })
    expect(result.kind).toBe("error")
  })

  test("returns error listing both audio names when two are present", () => {
    const result = resolveCueAudioFile({
      cuePath: "/music/Album/Album.cue",
      audioFileHint: null,
      dirEntries: ["Album.cue", "Album.flac", "Other.wav"],
    })
    expect(result.kind).toBe("error")
    if (result.kind !== "error") return
    expect(result.reason).toMatch(/Album\.flac/)
    expect(result.reason).toMatch(/Other\.wav/)
  })

  test("accepts every supported lossless extension (.flac/.wav/.ape/.wv/.tta/.tak)", () => {
    const extensions = [
      "flac",
      "wav",
      "ape",
      "wv",
      "tta",
      "tak",
    ]
    extensions.forEach((extension) => {
      const result = resolveCueAudioFile({
        cuePath: "/music/Album/Album.cue",
        audioFileHint: null,
        dirEntries: ["Album.cue", `Album.${extension}`],
      })
      expect(result.kind).toBe("ok")
    })
  })
})
