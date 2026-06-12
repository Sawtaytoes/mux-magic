import { vol } from "memfs"
import { firstValueFrom, of } from "rxjs"
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"
import { addSubtitles } from "./addSubtitles.js"

// mergeSubtitlesMkvMerge is auto-mocked globally in vitest.setup.ts.
// Import the already-mocked symbol directly.
const { mergeSubtitlesMkvMerge } = await import(
  "../cli-spawn-operations/mergeSubtitlesMkvMerge.js"
)

describe(addSubtitles.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vol.reset()
    // mergeSubtitlesMkvMerge emits the optional language-fix records
    // ending with null (see the op's `endWith(null)`); mimic the
    // "no und tracks" case so the success path reduces to one record.
    vi.mocked(mergeSubtitlesMkvMerge).mockReturnValue(
      of(null),
    )
  })

  test("errors with a swap hint when sourcePath holds the subtitle folders and subtitlesPath holds the media", async () => {
    // sourcePath points at the EXTRACTED-SUBTITLES dir (folders, no video)…
    // …and subtitlesPath points at the media dir (the .mkv files). Swapped.
    vol.fromJSON({
      "/media/EXTRACTED-SUBTITLES/ep1/track2.eng.ass":
        "sub",
      "/media/ep1.mkv": "video",
    })

    await expect(
      firstValueFrom(
        addSubtitles({
          sourcePath: "/media/EXTRACTED-SUBTITLES",
          subtitlesPath: "/media",
        }),
      ),
    ).rejects.toThrow(/look swapped/)

    expect(mergeSubtitlesMkvMerge).not.toHaveBeenCalled()
  })

  test("errors plainly when sourcePath simply has no media files", async () => {
    vol.fromJSON({
      "/media/EMPTY/.keep": "",
      "/subs/.keep": "",
    })

    await expect(
      firstValueFrom(
        addSubtitles({
          sourcePath: "/media/EMPTY",
          subtitlesPath: "/subs",
        }),
      ),
    ).rejects.toThrow(/no video files found/)
  })

  test("emits one { filePath } record per muxed media file", async () => {
    vol.fromJSON({
      "/media/ep1.mkv": "video",
      "/subs/ep1/track2.eng.ass": "sub",
    })

    const results = (await firstValueFrom(
      addSubtitles({
        sourcePath: "/media",
        subtitlesPath: "/subs",
      }),
    )) as Array<{ filePath: string }>

    expect(mergeSubtitlesMkvMerge).toHaveBeenCalledTimes(1)
    expect(results).toHaveLength(1)
    // Output lands in the SUBTITLED subfolder beside the source. Path
    // separator is OS-specific (join/dirname), so match loosely.
    expect(results[0].filePath).toMatch(
      /SUBTITLED[\\/]ep1\.mkv$/,
    )
  })
})
