import {
  __resetTaskSchedulerForTests,
  initTaskScheduler,
} from "@mux-magic/tools"
import { vol } from "memfs"
import { afterEach, beforeEach, vi } from "vitest"
import { disableJobPersistenceForTests } from "./src/api/jobStore.js"

// Always mock `fs` because it's used everywhere, and we never want to hit the filesystem.
vi.mock("node:fs")
vi.mock("node:fs/promises")

// Auto-mock every module under cli-spawn-operations/ — they all wrap
// 3rd-party CLI binaries (mkvextract / mkvmerge / mkvpropedit / ffmpeg
// / fpcalc) that aren't installed in CI and can't be safely spawned
// during tests. Same rationale as the node:fs → memfs auto-mock above:
// the test-environment boundary is the process-spawn layer.
//
// Tests opt in to per-call behavior with vi.mocked(fn).mockReturnValue(...)
// or vi.mocked(fn).mockImplementation(...). Forgetting to stub a spawn-op
// throws an explicit error — loud failure, not a real process spawn.
//
// Files that export non-function values (DefaultProps objects, string
// constants) include those real values so the production modules that
// import them at evaluation time keep working.

const makeSpawnOpFn = (name: string) =>
  vi.fn(() => {
    throw new Error(
      `spawn-op ${name} called without a mock — stub it with vi.mocked(${name}).mockReturnValue(...) — see docs/workers/57_auto-mock-cli-spawn-operations.md`,
    )
  })

vi.mock(
  "./src/cli-spawn-operations/convertContainerAudioFileToFlac.js",
  () => ({
    convertContainerAudioFileToFlac: makeSpawnOpFn(
      "convertContainerAudioFileToFlac",
    ),
    convertContainerAudioFileToFlacDefaultProps: {
      isSourceDeleted: false,
    },
  }),
)

vi.mock(
  "./src/cli-spawn-operations/convertFlacToPcmAudio.js",
  () => ({
    convertFlacToPcmAudio: makeSpawnOpFn(
      "convertFlacToPcmAudio",
    ),
    convertFlacToPcmAudioDefaultProps: {
      outputFolderName: "AUDIO-CONVERTED",
    },
    convertedPath: "AUDIO-CONVERTED",
  }),
)

vi.mock(
  "./src/cli-spawn-operations/convertLosslessFileToFlac.js",
  () => ({
    convertLosslessFileToFlac: makeSpawnOpFn(
      "convertLosslessFileToFlac",
    ),
    convertLosslessFileToFlacDefaultProps: {
      isSourceDeleted: false,
    },
  }),
)

vi.mock(
  "./src/cli-spawn-operations/convertVariableToConstantBitrate.js",
  () => ({
    constantBitrateFolderName: "CONSTANT-BITRATE",
    convertVariableToConstantBitrate: makeSpawnOpFn(
      "convertVariableToConstantBitrate",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/defineLanguageForUndefinedTracks.js",
  () => ({
    defineLanguageForUndefinedTracks: makeSpawnOpFn(
      "defineLanguageForUndefinedTracks",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/extractFlacAudio.js",
  () => ({
    extractedPath: "EXTRACTED-FLAC-AUDIO",
    extractFlacAudio: makeSpawnOpFn("extractFlacAudio"),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/extractSubtitleTracks.js",
  () => ({
    extractSubtitleTracks: makeSpawnOpFn(
      "extractSubtitleTracks",
    ),
    extractSubtitleTracksDefaultProps: {
      outputFolderName: "EXTRACTED-SUBTITLES",
    },
  }),
)

vi.mock(
  "./src/cli-spawn-operations/getAspectRatioData.js",
  () => ({
    getAspectRatio: makeSpawnOpFn("getAspectRatio"),
    getArgsForSeconds: makeSpawnOpFn("getArgsForSeconds"),
    getAspectRatioData: makeSpawnOpFn("getAspectRatioData"),
    getRelativeAspectRatio: makeSpawnOpFn(
      "getRelativeAspectRatio",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/getAudioOffset.js",
  () => ({
    audioOffsetsFolderName: "AUDIO-OFFSETS",
    getAudioOffset: makeSpawnOpFn("getAudioOffset"),
    getAudioOffsetDefaultProps: {
      isOverwritingExtractedAudio: false,
      outputFolderName: "AUDIO-OFFSETS",
    },
  }),
)

vi.mock(
  "./src/cli-spawn-operations/getChapters.js",
  () => ({
    FALLBACK_TIMECODE: "00:00:00.000000000",
    getChapters: makeSpawnOpFn("getChapters"),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/getChapters-old.js",
  () => ({
    getChaptersOld: makeSpawnOpFn("getChaptersOld"),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/inverseTelecineVideo.js",
  () => ({
    inverseTelecineVideo: makeSpawnOpFn(
      "inverseTelecineVideo",
    ),
    inverseTelecinedPath: "INVERSE-TELECINED",
  }),
)

vi.mock(
  "./src/cli-spawn-operations/keepSpecifiedLanguageTracks.js",
  () => ({
    keepSpecifiedLanguageTracks: makeSpawnOpFn(
      "keepSpecifiedLanguageTracks",
    ),
    keepSpecifiedLanguageTracksDefaultProps: {
      outputFolderName: "LANGUAGE-TRIMMED",
    },
  }),
)

vi.mock(
  "./src/cli-spawn-operations/mergeMediaFiles.js",
  () => ({
    mergeMediaFiles: makeSpawnOpFn("mergeMediaFiles"),
    mergedMediaFilesFolderName: "MERGED-MEDIA",
  }),
)

vi.mock(
  "./src/cli-spawn-operations/mergeSubtitlesMkvMerge.js",
  () => ({
    mergeSubtitlesMkvMerge: makeSpawnOpFn(
      "mergeSubtitlesMkvMerge",
    ),
    mergeSubtitlesMkvMergeDefaultProps: {
      outputFolderName: "SUBTITLED",
    },
    subtitledFolderName: "SUBTITLED",
  }),
)

vi.mock(
  "./src/cli-spawn-operations/mergeTracksFfmpeg.js",
  () => ({
    mergedPath: "MERGED",
    mergeTracksFfmpeg: makeSpawnOpFn("mergeTracksFfmpeg"),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/remuxMkvMerge.js",
  () => ({
    remuxMkvMerge: makeSpawnOpFn("remuxMkvMerge"),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/reorderTracksFfmpeg.js",
  () => ({
    reorderTracksFfmpeg: makeSpawnOpFn(
      "reorderTracksFfmpeg",
    ),
    reorderTracksFfmpegDefaultProps: {
      outputFolderName: "REORDERED-TRACKS",
    },
    reorderedTracksPath: "REORDERED-TRACKS",
  }),
)

vi.mock(
  "./src/cli-spawn-operations/reorderTracksMkvMerge.js",
  () => ({
    reorderTracksFolderName: "REORDERED-TRACKS",
    reorderTracksMkvMerge: makeSpawnOpFn(
      "reorderTracksMkvMerge",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/replaceAttachmentsMkvMerge.js",
  () => ({
    replaceAttachmentsMkvMerge: makeSpawnOpFn(
      "replaceAttachmentsMkvMerge",
    ),
    replaceAttachmentsMkvMergeDefaultProps: {
      outputFolderName: "REPLACED-ATTACHMENTS",
    },
    replacedAttachmentsFolderName: "REPLACED-ATTACHMENTS",
  }),
)

vi.mock(
  "./src/cli-spawn-operations/replaceTrackById.js",
  () => ({
    replaceTrackById: makeSpawnOpFn("replaceTrackById"),
    replacedTrackPath: "TRACK-REPLACED",
  }),
)

vi.mock(
  "./src/cli-spawn-operations/replaceTracksMkvMerge.js",
  () => ({
    replaceTracksMkvMerge: makeSpawnOpFn(
      "replaceTracksMkvMerge",
    ),
    replaceTracksMkvMergeDefaultProps: {
      outputFolderName: "REPLACED-TRACKS",
    },
    replacedTracksFolderName: "REPLACED-TRACKS",
  }),
)

vi.mock(
  "./src/cli-spawn-operations/runAudioOffsetFinder.js",
  () => ({
    getOffsetFromAudioOffsetOutput: makeSpawnOpFn(
      "getOffsetFromAudioOffsetOutput",
    ),
    runAudioOffsetFinder: makeSpawnOpFn(
      "runAudioOffsetFinder",
    ),
  }),
)

vi.mock("./src/cli-spawn-operations/runFfmpeg.js", () => ({
  convertNaNToTimecode: makeSpawnOpFn(
    "convertNaNToTimecode",
  ),
  extensionMimeType: {
    ".otf": "mimetype=application/x-opentype-font",
    ".ttf": "mimetype=application/x-truetype-font",
  },
  runFfmpeg: makeSpawnOpFn("runFfmpeg"),
}))

vi.mock(
  "./src/cli-spawn-operations/runFfmpegAudioTranscode.js",
  () => ({
    buildFfmpegArgs: makeSpawnOpFn("buildFfmpegArgs"),
    runFfmpegAudioTranscode: makeSpawnOpFn(
      "runFfmpegAudioTranscode",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/runMkvExtract.js",
  () => ({
    runMkvExtract: makeSpawnOpFn("runMkvExtract"),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/runMkvExtractStdOut.js",
  () => ({
    runMkvExtractStdOut: makeSpawnOpFn(
      "runMkvExtractStdOut",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/runMkvMerge.js",
  () => ({
    runMkvMerge: makeSpawnOpFn("runMkvMerge"),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/runMkvPropEdit.js",
  () => ({
    runMkvPropEdit: makeSpawnOpFn("runMkvPropEdit"),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/runReadlineFfmpeg.js",
  () => ({
    runReadlineFfmpeg: makeSpawnOpFn("runReadlineFfmpeg"),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/setDisplayWidthMkvPropEdit.js",
  () => ({
    setDisplayWidthMkvPropEdit: makeSpawnOpFn(
      "setDisplayWidthMkvPropEdit",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/setOnlyFirstTracksAsDefault.js",
  () => ({
    setOnlyFirstTracksAsDefault: makeSpawnOpFn(
      "setOnlyFirstTracksAsDefault",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/splitChaptersFfmpeg.js",
  () => ({
    segmentSplitsFolderName: "SEGMENT-SPLITS",
    splitSegmentFfmpeg: makeSpawnOpFn("splitSegmentFfmpeg"),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/splitChaptersMkvMerge.js",
  () => ({
    splitChaptersMkvMerge: makeSpawnOpFn(
      "splitChaptersMkvMerge",
    ),
    splitChaptersMkvMergeDefaultProps: {
      outputFolderName: "SPLITS",
    },
    splitsFolderName: "SPLITS",
  }),
)

vi.mock(
  "./src/cli-spawn-operations/splitCueSheetFfmpeg.js",
  () => ({
    splitCueSheetFfmpeg: makeSpawnOpFn(
      "splitCueSheetFfmpeg",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/treeKillChild.js",
  () => ({
    treeKillOnUnsubscribe: makeSpawnOpFn(
      "treeKillOnUnsubscribe",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/updateTrackLanguage.js",
  () => ({
    updateTrackLanguage: makeSpawnOpFn(
      "updateTrackLanguage",
    ),
  }),
)

vi.mock(
  "./src/cli-spawn-operations/writeChaptersMkvMerge.js",
  () => ({
    writeChaptersMkvMerge: makeSpawnOpFn(
      "writeChaptersMkvMerge",
    ),
  }),
)

// memfs is POSIX-only, and the test fixtures all use POSIX paths
// (`/work`, `/seq-root`, `/media`). Default `getPlatform` to "linux" so
// platform-gated guards in production code (notably the drive-relative
// path check in `pathSafety.ts`) treat the fixtures as legitimate
// absolute paths instead of rejecting them when the runner happens to be
// a Windows host. Tests that need win32-specific behavior re-stub
// `getPlatform` locally via `vi.mocked(getPlatform).mockReturnValue(...)`.
// Tools that read `os.platform()` (`isNetworkPath`, `openInExternalApp`,
// `appPaths`) are unaffected — they go through `node:os`, not this shim.
vi.mock("./src/tools/currentEnvironment.js", () => ({
  getCwd: vi.fn(() => "/work"),
  getPlatform: vi.fn(() => "linux"),
}))

beforeEach(() => {
  initTaskScheduler(Infinity)
  disableJobPersistenceForTests()
})

afterEach(() => {
  vol.reset()

  __resetTaskSchedulerForTests()
})
