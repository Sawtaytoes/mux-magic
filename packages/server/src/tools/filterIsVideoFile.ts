import { extname } from "node:path"
import type { FileInfo } from "@mux-magic/tools"
import { filter } from "rxjs"

export const videoFileExtensions = new Set([
  ".avi",
  ".m2ts",
  ".mkv",
  ".mp4",
  ".ogm",
  ".ts",
])

export const getIsVideoFile = (sourceFilePath: string) =>
  videoFileExtensions.has(extname(sourceFilePath))

export const filterIsVideoFile = () =>
  filter((fileInfo: FileInfo) =>
    getIsVideoFile(fileInfo.fullPath),
  )
