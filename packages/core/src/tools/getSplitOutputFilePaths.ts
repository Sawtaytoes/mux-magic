// mkvmerge never writes the `--output` path when `--split` is in play. It
// inserts a running number before the extension instead, so
// `-o "Gintama S01.mkv" --split chapters:7,18` produces
// `Gintama S01-001.mkv`, `Gintama S01-002.mkv`, `Gintama S01-003.mkv`.
//
// The spawn op still emits the un-split `--output` path, so this helper
// turns that path plus a directory listing back into the real part paths.
// It is pure — the caller does the `readdir`.

import { basename, dirname, extname, join } from "node:path"
import { naturalSort } from "@mux-magic/tools"

const isDigitsOnly = (value: string) =>
  value.length > 0 && /^\d+$/.test(value)

export const getSplitOutputFilePaths = ({
  fileNames,
  outputFilePath,
}: {
  fileNames: ReadonlyArray<string>
  outputFilePath: string
}) => {
  const outputFileName = basename(outputFilePath)
  const outputExtension = extname(outputFileName)
  const partPrefix = `${outputFileName.slice(
    0,
    outputFileName.length - outputExtension.length,
  )}-`
  const parts = fileNames
    .filter(
      (fileName) =>
        fileName.startsWith(partPrefix) &&
        fileName.endsWith(outputExtension),
    )
    .map((fileName) => ({
      fileName,
      partNumber: fileName.slice(
        partPrefix.length,
        fileName.length - outputExtension.length,
      ),
    }))
    .filter(({ partNumber }) => isDigitsOnly(partNumber))
  return naturalSort(parts)
    .by({ asc: (part) => part.partNumber })
    .map(({ fileName }) =>
      join(dirname(outputFilePath), fileName),
    )
}
