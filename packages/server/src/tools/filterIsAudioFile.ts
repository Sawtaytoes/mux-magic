import { extname } from "node:path"
import { filter } from "rxjs"

import { type FileInfo } from "./getFiles.js"

export const audioFileExtensions = (
  new Set([
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
)

export const getIsAudioFile = (
  sourceFilePath: string
) => (
  audioFileExtensions
  .has(
    extname(
      sourceFilePath
    )
  )
)

export const filterIsAudioFile = () => (
  filter((
    fileInfo: FileInfo
  ) => (
    getIsAudioFile(
      fileInfo
      .fullPath
    )
  ))
)
