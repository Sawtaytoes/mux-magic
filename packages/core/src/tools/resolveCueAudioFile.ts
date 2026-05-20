import { dirname, extname, join } from "node:path"
import { logInfo } from "@mux-magic/tools"

// Supported lossless audio extensions for CUE-paired album rips. We
// recognize the same set ffmpeg can decode losslessly so a renamed
// FILE line can still be rescued when exactly one of these lives next
// to the CUE.
const LOSSLESS_EXTENSIONS = new Set([
  ".flac",
  ".wav",
  ".ape",
  ".wv",
  ".tta",
  ".tak",
])

export type ResolveCueAudioOk = {
  kind: "ok"
  path: string
}

export type ResolveCueAudioError = {
  kind: "error"
  reason: string
}

export type ResolvedCueAudio =
  | ResolveCueAudioOk
  | ResolveCueAudioError

export const resolveCueAudioFile = ({
  cuePath,
  audioFileHint,
  dirEntries,
}: {
  cuePath: string
  audioFileHint: string | null
  dirEntries: ReadonlyArray<string>
}): ResolvedCueAudio => {
  const cueFolder = dirname(cuePath)

  if (
    audioFileHint !== null &&
    dirEntries.includes(audioFileHint)
  ) {
    return {
      kind: "ok",
      path: join(cueFolder, audioFileHint),
    }
  }

  const losslessEntries = dirEntries.filter((entry) =>
    LOSSLESS_EXTENSIONS.has(extname(entry).toLowerCase()),
  )

  if (losslessEntries.length === 1) {
    const fallback = losslessEntries[0]
    const hintMessage =
      audioFileHint === null
        ? "no FILE line"
        : `FILE "${audioFileHint}" missing`
    logInfo(
      "CUE",
      `${cuePath}: ${hintMessage}; using ${fallback}`,
    )
    return {
      kind: "ok",
      path: join(cueFolder, fallback),
    }
  }

  if (losslessEntries.length === 0) {
    return {
      kind: "error",
      reason: `No lossless audio file found beside ${cuePath} (looked for ${Array.from(LOSSLESS_EXTENSIONS).join(", ")}).`,
    }
  }

  return {
    kind: "error",
    reason: `Multiple lossless audio files beside ${cuePath}: ${losslessEntries.join(
      ", ",
    )}. Add a FILE line to the CUE to disambiguate.`,
  }
}
