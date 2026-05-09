import { readFile } from "node:fs/promises"
import { extname } from "node:path"
import {
  defer,
  filter,
  map,
  toArray,
} from "rxjs"

import { type AssScriptInfoProperty } from "../tools/assTypes.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { parseAssFile } from "../tools/assFileTools.js"
import { withFileProgress } from "../tools/progressEmitter.js"

export type SubtitleFileMetadata = {
  filePath: string
  scriptInfo: Record<string, string>
  styles: Record<string, string>[]
}

type GetSubtitleMetadataRequiredProps = {
  isRecursive: boolean
  sourcePath: string
}

type GetSubtitleMetadataOptionalProps = {
  recursiveDepth?: number
}

export type GetSubtitleMetadataProps = (
  GetSubtitleMetadataRequiredProps
  & GetSubtitleMetadataOptionalProps
)

export const getSubtitleMetadata = ({
  isRecursive,
  recursiveDepth,
  sourcePath,
}: GetSubtitleMetadataProps) => (
  getFilesAtDepth({
    depth: (
      isRecursive
      ? (recursiveDepth || 2)
      : 0
    ),
    sourcePath,
  })
  .pipe(
    filter((fileInfo) => (
      extname(fileInfo.fullPath).toLowerCase() === ".ass"
    )),
    withFileProgress((fileInfo) => (
      defer(() => (
        readFile(
          fileInfo.fullPath,
          "utf-8",
        )
      ))
      .pipe(
        map((content): SubtitleFileMetadata => {
          const assFile = parseAssFile(content)

          const scriptInfoSection = assFile.sections.find(
            (s) => s.sectionType === "scriptInfo",
          )
          const scriptInfo: Record<string, string> = (
            scriptInfoSection?.sectionType === "scriptInfo"
            ? Object.fromEntries(
              scriptInfoSection.entries
              .filter((e): e is AssScriptInfoProperty => e.type === "property")
              .map((e) => [e.key, e.value])
            )
            : {}
          )

          const stylesSection = assFile.sections.find(
            (s) => s.sectionType === "formatted"
              && s.entries.some((e) => e.entryType === "Style"),
          )
          const styles: Record<string, string>[] = (
            stylesSection?.sectionType === "formatted"
            ? stylesSection.entries
              .filter((e) => e.entryType === "Style")
              .map((e) => e.fields)
            : []
          )

          return {
            filePath: fileInfo.fullPath,
            scriptInfo,
            styles,
          }
        }),
      )
    )),
    toArray(),
    logAndRethrow(getSubtitleMetadata),
  )
)
