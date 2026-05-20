import { extname } from "node:path"
import type { FileInfo } from "@mux-magic/tools"
import { filter } from "rxjs"

// Sibling of filterIsAudioFile.ts. The broader audio filter matches
// every supported container (.mp3, .flac, .mkv, etc.), which is too
// loose for the lossless → FLAC encoder: we want only inputs whose
// container convention implies a lossless codec.
//
// Extension-based, deliberately not MediaInfo-probed. The codebase's
// position is that conventional extensions for these formats reliably
// indicate lossless content in a music library:
// - .wav / .wave — PCM (technically WAV can hold non-PCM codecs, but
//   ripping software and tagging tools all treat .wav as PCM by
//   convention).
// - .aif / .aiff — Audio Interchange File Format (PCM).
// - .m4a / .m4b — ALAC by convention when the user has a music
//   directory; AAC-in-m4a is rare in a rip/library context.
//
// .flac is intentionally excluded — re-encoding a FLAC to FLAC is
// pointless and would only happen via a future "re-compress with
// -compression_level 8" command (a separate worker).
//
// MKV / MP4 / M4V / MOV / WebM / AVI deliberately are NOT accepted:
// they're container-with-video, which needs MediaInfo probing to know
// whether they're losslessly convertible and whether they have a
// video track the user wouldn't want to silently drop. That detection
// is the job of a separate "has-video-track in a music dir" worker.
export const losslessAudioFileExtensions = new Set([
  ".aif",
  ".aiff",
  ".m4a",
  ".m4b",
  ".wav",
  ".wave",
])

export const getIsLosslessAudioFile = (
  sourceFilePath: string,
) =>
  losslessAudioFileExtensions.has(
    extname(sourceFilePath).toLowerCase(),
  )

export const filterIsLosslessAudioFile = () =>
  filter((fileInfo: FileInfo) =>
    getIsLosslessAudioFile(fileInfo.fullPath),
  )
