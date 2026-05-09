import { extname } from "node:path"
import { filter } from "rxjs"

import { type FileInfo } from "./getFiles.js"

export const subtitlesFileExtensions = [
  ".ass",
  ".srt",
  ".ssa",
  ".sup",
] as const

export const subtitlesFileExtensionSet = (
  new Set(
    subtitlesFileExtensions
  )
)

export const getIsSubtitlesFile = (
  sourceFilePath: string
) => (
  subtitlesFileExtensionSet
  .has(
    extname(
      sourceFilePath
    )
  )
)

export const filterIsSubtitlesFile = () => (
  filter((
    fileInfo: FileInfo
  ) => (
    getIsSubtitlesFile(
      fileInfo
      .fullPath
    )
  ))
)
