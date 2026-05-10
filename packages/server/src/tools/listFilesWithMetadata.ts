import { readdir, stat } from "node:fs/promises"
import { extname, join, sep as nativePathSeparator } from "node:path"

import { lastValueFrom } from "rxjs"

import {
  convertDurationToDvdCompareTimecode,
  getFileDuration,
} from "./getFileDuration.js"
import { getMediaInfo } from "./getMediaInfo.js"
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
  // Video runtime as 'M:SS' or 'H:MM:SS', matching the DVDCompare
  // listing format the user is comparing against. null when:
  //   - includeDuration option was false
  //   - the entry is not a video file (extension check)
  //   - mediainfo failed (corrupt file, missing CLI binary, etc.)
  duration: string | null
}

export type ListFilesWithMetadataOptions = {
  // Run mediainfo on each video-extension file to populate `duration`.
  // Off by default since each call spawns the mediainfo binary; on a
  // network share this can take ~100ms per file. Concurrency is capped
  // at 8 internally so a folder of 100 files doesn't spawn 100 procs.
  includeDuration?: boolean
}

export type ListFilesWithMetadataResult = {
  entries: FileExplorerEntry[]
  separator: string
}

// Extensions that mediainfo will produce a useful duration for. The
// explorer also shows .iso / .vob entries on disc-rip workflows, but
// those don't surface a single Duration the way single-stream containers
// do — leave them as null rather than spawning a doomed mediainfo.
const VIDEO_EXTENSIONS = new Set([
  ".mkv",
  ".mp4",
  ".m4v",
  ".webm",
  ".avi",
  ".mov",
  ".mpg",
  ".mpeg",
  ".ts",
  ".wmv",
])

const isVideoExtension = (name: string): boolean => (
  VIDEO_EXTENSIONS.has(extname(name).toLowerCase())
)

// Concurrent map with a fixed worker count. AsyncPool-style — keeps a
// constant N inflight, settles via a per-item Promise resolver.
// Avoids pulling in p-map when 30 lines of native code do the job.
const mapWithConcurrency = async <T, U>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<U>,
): Promise<U[]> => {
  const results: U[] = new Array(items.length)
  let cursor = 0
  const runWorker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      runWorker,
    ),
  )
  return results
}

const computeDuration = async (filePath: string): Promise<string | null> => {
  try {
    const mediaInfo = await lastValueFrom(getMediaInfo(filePath))
    if (!mediaInfo) return null
    const seconds = await lastValueFrom(getFileDuration({ mediaInfo }))
    if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null
    return convertDurationToDvdCompareTimecode(Math.round(seconds))
  }
  catch {
    return null
  }
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
// When `includeDuration` is true, mediainfo is invoked per video-
// extension file (concurrency 8) and runtime is rendered in DVDCompare-
// compatible 'M:SS' / 'H:MM:SS' format so the user can directly compare
// the explorer to a DVDCompare release listing.
//
// Path is validated as absolute and traversal-free before any fs calls.
export const listFilesWithMetadata = async (
  path: string,
  options: ListFilesWithMetadataOptions = {},
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
          duration: null,
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
          duration: null,
        }
      }
    }),
  )

  // Sort: directories first (capital D > files alphabetically wouldn't
  // give that property naturally), then case-insensitive name. Mirrors
  // standard file-explorer expectations.
  entries.sort((entryA, entryB) => {
    if (entryA.isDirectory !== entryB.isDirectory) {
      return entryA.isDirectory ? -1 : 1
    }
    return entryA.name.localeCompare(entryB.name, undefined, { sensitivity: "base" })
  })

  if (options.includeDuration) {
    // Indexes of video-extension files only — directories and non-video
    // files stay duration: null. mapWithConcurrency keeps the parallel
    // mediainfo spawns capped at 8.
    const videoIndexes = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.isFile && isVideoExtension(entry.name))
    const durations = await mapWithConcurrency(
      videoIndexes,
      8,
      ({ entry }) => computeDuration(join(validatedPath, entry.name)),
    )
    videoIndexes.forEach(({ index }, durationIndex) => {
      entries[index].duration = durations[durationIndex]
    })
  }

  return {
    entries,
    separator: nativePathSeparator,
  }
}
