import { readFile } from "node:fs/promises"
import { extname } from "node:path"
import {
  getFilesAtDepth,
  logAndRethrowPipelineError,
} from "@mux-magic/tools"
import { defer, filter, map, toArray } from "rxjs"
import { parseAssFile } from "../tools/assFileTools.js"
import type { AssScriptInfoProperty } from "../tools/assTypes.js"
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

export type GetSubtitleMetadataProps =
  GetSubtitleMetadataRequiredProps &
    GetSubtitleMetadataOptionalProps

export const getSubtitleMetadata = ({
  isRecursive,
  recursiveDepth,
  sourcePath,
}: GetSubtitleMetadataProps) =>
  getFilesAtDepth({
    depth: isRecursive ? recursiveDepth || 1 : 0,
    sourcePath,
  }).pipe(
    filter(
      (fileInfo) =>
        extname(fileInfo.fullPath).toLowerCase() === ".ass",
    ),
    withFileProgress((fileInfo) =>
      defer(() =>
        readFile(fileInfo.fullPath, "utf-8"),
      ).pipe(
        map((content): SubtitleFileMetadata => {
          const assFile = parseAssFile(content)

          const scriptInfoSection = assFile.sections.find(
            (section) =>
              section.sectionType === "scriptInfo",
          )
          const scriptInfo: Record<string, string> =
            scriptInfoSection?.sectionType === "scriptInfo"
              ? Object.fromEntries(
                  scriptInfoSection.entries
                    .filter(
                      (
                        entry,
                      ): entry is AssScriptInfoProperty =>
                        entry.type === "property",
                    )
                    .map((entry) => [
                      entry.key,
                      entry.value,
                    ]),
                )
              : {}

          const stylesSection = assFile.sections.find(
            (section) =>
              section.sectionType === "formatted" &&
              section.entries.some(
                (entry) => entry.entryType === "Style",
              ),
          )
          const styles: Record<string, string>[] =
            stylesSection?.sectionType === "formatted"
              ? stylesSection.entries
                  .filter(
                    (entry) => entry.entryType === "Style",
                  )
                  .map((entry) => entry.fields)
              : []

          return {
            filePath: fileInfo.fullPath,
            scriptInfo,
            styles,
          }
        }),
      ),
    ),
    toArray(),
    logAndRethrowPipelineError(getSubtitleMetadata),
  )
