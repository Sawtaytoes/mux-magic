import { readdir, stat } from "node:fs/promises"
import { join, sep as nativePathSeparator } from "node:path"

import { validateReadablePath } from "./pathSafety.js"

export type FileExplorerEntry = {
  name: string
  isDirectory: boolean
  isFile: boolean
  // Bytes; 0 for directories. Surface as a number even though it could
  // overflow JS-safe-int — disc rips on this tool live in the GB range,
  // well under 2^53. Petabyte files are not in scope.
  size: number
  // ISO timestamp; null if stat fails for an individual entry (we keep
  // the entry in the listing rather than omit it, so the user still sees
  // the file exists even if we can't read its mtime).
  mtime: string | null
}

export type ListFilesWithMetadataResult = {
  entries: FileExplorerEntry[]
  separator: string
}

// Lists files in a directory with metadata for the file-explorer modal.
// Distinct from listDirectoryEntries (the typeahead utility) because:
//
//   1. The explorer renders one screen of files at a time, so the extra
//      stat() per entry is fine — the typeahead fires per-keystroke and
//      can't afford it.
//   2. The explorer needs size + mtime, not just isDirectory + name.
//   3. The explorer's `path` argument must be a directory (no fallback
//      to dirname), since you're explicitly browsing a folder rather
//      than typing a path.
//
// Path is validated as absolute and traversal-free before any fs calls.
export const listFilesWithMetadata = async (
  path: string,
): Promise<ListFilesWithMetadataResult> => {
  const validatedPath = validateReadablePath(path)

  const dirEntries = await readdir(validatedPath, { withFileTypes: true })

  const entries: FileExplorerEntry[] = await Promise.all(
    dirEntries.map(async (dirEntry) => {
      const fullPath = join(validatedPath, dirEntry.name)
      try {
        const stats = await stat(fullPath)
        return {
          name: dirEntry.name,
          isDirectory: dirEntry.isDirectory(),
          isFile: dirEntry.isFile(),
          size: stats.size,
          mtime: stats.mtime.toISOString(),
        }
      }
      catch {
        // Stat failed (broken symlink, permissions, etc.). Keep the
        // entry visible so the user knows it exists; mark mtime null
        // and size 0 so the renderer can show a placeholder.
        return {
          name: dirEntry.name,
          isDirectory: dirEntry.isDirectory(),
          isFile: dirEntry.isFile(),
          size: 0,
          mtime: null,
        }
      }
    }),
  )

  // Sort: directories first (capital D > files alphabetically wouldn't
  // give that property naturally), then case-insensitive name. Mirrors
  // standard file-explorer expectations.
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })

  return {
    entries,
    separator: nativePathSeparator,
  }
}
