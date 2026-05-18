import { extname } from "node:path"
import type { FileInfo } from "@mux-magic/tools"
import { filter } from "rxjs"

export const audioFileExtensions = new Set([
  ".aac",
  ".aiff",
  ".alac",
  ".flac",
  ".m4a",
  ".mkv",
  ".mp3",
  ".mp4",
  ".ogg",
  ".wav",
  ".wma",
])

export const getIsAudioFile = (sourceFilePath: string) =>
  audioFileExtensions.has(extname(sourceFilePath))

export const filterIsAudioFile = () =>
  filter((fileInfo: FileInfo) =>
    getIsAudioFile(fileInfo.fullPath),
  )
