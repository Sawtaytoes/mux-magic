import { extname } from "node:path"
import type { FileInfo } from "@mux-magic/tools"
import { filter } from "rxjs"

export const subtitlesFileExtensions = [
  ".ass",
  ".srt",
  ".ssa",
  ".sup",
] as const

export const subtitlesFileExtensionSet = new Set(
  subtitlesFileExtensions,
)

export const getIsSubtitlesFile = (
  sourceFilePath: string,
) => subtitlesFileExtensionSet.has(extname(sourceFilePath))

export const filterIsSubtitlesFile = () =>
  filter((fileInfo: FileInfo) =>
    getIsSubtitlesFile(fileInfo.fullPath),
  )
