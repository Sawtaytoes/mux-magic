import { extname } from "node:path"
import type { FileInfo } from "@mux-magic/tools"
import { filter } from "rxjs"

// Sibling of filterIsAudioFile.ts. The broader audio filter matches
// every supported container (.mp3, .flac, .mkv, etc.), which is too
// loose for the WAV → FLAC encoder: we only want standalone uncompressed
// PCM WAV inputs, never the MKVs that filterIsAudioFile would also
// pull in.
export const getIsWavFile = (sourceFilePath: string) =>
  extname(sourceFilePath).toLowerCase() === ".wav"

export const filterIsWavFile = () =>
  filter((fileInfo: FileInfo) =>
    getIsWavFile(fileInfo.fullPath),
  )
