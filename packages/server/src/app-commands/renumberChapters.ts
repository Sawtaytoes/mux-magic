import {
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  aclSafeCopyFile,
  getFilesAtDepth,
  logAndRethrowPipelineError,
  logError,
} from "@mux-magic/tools"
import {
  catchError,
  defer,
  EMPTY,
  from,
  map,
  mergeMap,
  Observable,
  of,
  toArray,
} from "rxjs"
import { runMkvExtractStdOut } from "../cli-spawn-operations/runMkvExtractStdOut.js"
import { writeChaptersMkvMerge } from "../cli-spawn-operations/writeChaptersMkvMerge.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { withFileProgress } from "../tools/progressEmitter.js"
import {
  type RenumberChapterXmlResult,
  renumberChapterXml,
} from "../tools/renumberChapterXml.js"

export type RenumberChaptersResult =
  | {
      action: "renumbered"
      filePath: string
      renamedCount: number
    }
  | {
      action: "already-sequential"
      filePath: string
    }
  | {
      action: "skipped"
      filePath: string
      reason:
        | "no-chapters"
        | "no-numbered-chapters"
        | "mixed-chapter-names"
    }

// Atomic-ish rename with cross-device fallback (EXDEV). When the temp file
// and the source live on different volumes, `rename` throws EXDEV — the
// copy + unlink pair handles it the same way the `aclSafeCopyFile` callers
// in copyFiles / flattenOutput already do.
const replaceOriginal = async ({
  destinationPath,
  tempPath,
}: {
  destinationPath: string
  tempPath: string
}) => {
  try {
    await rename(tempPath, destinationPath)
  } catch (error) {
    const errnoError = error as NodeJS.ErrnoException
    if (errnoError.code !== "EXDEV") {
      throw error
    }
    await aclSafeCopyFile(tempPath, destinationPath)
    await unlink(tempPath)
  }
}

const buildSkipReason = (
  xmlResult: RenumberChapterXmlResult,
):
  | "no-chapters"
  | "no-numbered-chapters"
  | "mixed-chapter-names"
  | null => {
  if (xmlResult.status === "no-chapters") {
    return "no-chapters"
  }
  if (xmlResult.status === "mixed") {
    return xmlResult.matchedCount === 0
      ? "no-numbered-chapters"
      : "mixed-chapter-names"
  }
  return null
}

const performRemux = ({
  filePath,
  isPaddingChapterNumbers,
  xmlResult,
}: {
  filePath: string
  isPaddingChapterNumbers: boolean
  xmlResult: RenumberChapterXmlResult
}): Observable<RenumberChaptersResult> =>
  defer(async (): Promise<RenumberChaptersResult> => {
    const randomSuffix = Math.random()
      .toString(36)
      .slice(2, 10)
    const tempXmlPath = join(
      tmpdir(),
      `mux-magic-chapters-${randomSuffix}.xml`,
    )
    const tempOutputPath = `${filePath}.renumbered.${randomSuffix}.mkv`
    await writeFile(tempXmlPath, xmlResult.xml, "utf8")
    try {
      await new Promise<string>((resolvePromise, reject) => {
        writeChaptersMkvMerge({
          chaptersXmlPath: tempXmlPath,
          inputFilePath: filePath,
          outputFilePath: tempOutputPath,
        }).subscribe({
          next: resolvePromise,
          error: reject,
          complete: () => resolvePromise(tempOutputPath),
        })
      })
      await replaceOriginal({
        destinationPath: filePath,
        tempPath: tempOutputPath,
      })
    } finally {
      // Best-effort temp-xml cleanup — leftover XML in /tmp is harmless.
      await rm(tempXmlPath, { force: true }).catch(
        () => {},
      )
    }
    // Suppress unused-var warning while preserving the binding for
    // future caller refactors that may want to switch padding behavior
    // mid-pipeline.
    void isPaddingChapterNumbers
    return {
      action: "renumbered",
      filePath,
      renamedCount: xmlResult.renamedCount,
    }
  })

const processFile = ({
  filePath,
  isPaddingChapterNumbers,
}: {
  filePath: string
  isPaddingChapterNumbers: boolean
}): Observable<RenumberChaptersResult> =>
  runMkvExtractStdOut({
    args: ["chapters", filePath],
  }).pipe(
    toArray(),
    map((chunks) => chunks.join("")),
    mergeMap((rawXml) => {
      // mkvextract emits nothing when the file has no chapter element;
      // treat empty stdout as "no chapters" without running the regex.
      if (rawXml.trim().length === 0) {
        return of<RenumberChaptersResult>({
          action: "skipped",
          filePath,
          reason: "no-chapters",
        })
      }
      const xmlResult = renumberChapterXml({
        isPaddingChapterNumbers,
        xml: rawXml,
      })
      const skipReason = buildSkipReason(xmlResult)
      if (skipReason !== null) {
        return of<RenumberChaptersResult>({
          action: "skipped",
          filePath,
          reason: skipReason,
        })
      }
      if (xmlResult.status === "already-sequential") {
        return of<RenumberChaptersResult>({
          action: "already-sequential",
          filePath,
        })
      }
      return performRemux({
        filePath,
        isPaddingChapterNumbers,
        xmlResult,
      })
    }),
    catchError((error) => {
      logError(processFile, error)
      return EMPTY
    }),
  )

export const renumberChapters = ({
  isPaddingChapterNumbers,
  isRecursive,
  sourcePath,
}: {
  isPaddingChapterNumbers: boolean
  isRecursive: boolean
  sourcePath: string
}) =>
  getFilesAtDepth({
    depth: isRecursive ? 1 : 0,
    sourcePath,
  }).pipe(
    filterIsVideoFile(),
    withFileProgress((fileInfo) =>
      processFile({
        filePath: fileInfo.fullPath,
        isPaddingChapterNumbers,
      }),
    ),
    logAndRethrowPipelineError(renumberChapters),
  )
