import { readdir, rename, stat } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

import {
  applyRenameRegex,
  logAndRethrowPipelineError,
  logInfo,
  type RenameRegex,
} from "@mux-magic/tools"
import {
  concatMap,
  defer,
  from,
  map,
  of,
  toArray,
} from "rxjs"

import {
  compileFilterRegex,
  type RegexFilterInput,
  validateRenameRegexChain,
} from "./copyFiles.js"

// The general renamer Mux-Magic did not have. Renaming was only ever a side
// effect of a naming command, and `renameFiles` covers files only — a
// folder full of `[Group] Show - 01 [1080p]` directories could not be
// touched without one of the media-specific commands having an opinion
// about the contents.
//
// Not music-specific, and listed under File Operations for that reason.
// The music work needed the same parts (path templating, collision checks,
// a dry run) which is why it arrives with it.
//
// Two rules that are not obvious:
//
//  1. **Folders rename deepest-first.** Renaming `A/` before `A/B/` would
//     invalidate the path of every child already planned, and the run would
//     fail halfway through with ENOENT on paths that existed when it
//     started.
//  2. **A collision is a skip, never an overwrite.** `fs.rename` onto an
//     existing file destroys it silently on POSIX. The row reports the
//     clash and the file is left alone.

export type RenameFilesAndFoldersRenamedRecord = {
  destination: string
  isDryRun: boolean
  kind: "renamed"
  source: string
  target: "file" | "folder"
}

export type RenameFilesAndFoldersUnchangedRecord = {
  kind: "unchanged"
  source: string
  target: "file" | "folder"
}

export type RenameFilesAndFoldersSkippedRecord = {
  kind: "skipped"
  reason: string
  source: string
  target: "file" | "folder"
}

export type RenameFilesAndFoldersRecord =
  | RenameFilesAndFoldersRenamedRecord
  | RenameFilesAndFoldersUnchangedRecord
  | RenameFilesAndFoldersSkippedRecord

export type RenameFilesAndFoldersProps = {
  isDryRun?: boolean
  isRenamingFiles?: boolean
  isRenamingFolders?: boolean
  nameFilterRegex?: RegexFilterInput
  recursiveDepth?: number
  renameRegex: RenameRegex
  sourcePath: string
}

type RenameEntry = {
  fullPath: string
  name: string
  // How many walk levels remain BELOW this entry's parent. The walk starts
  // at `recursiveDepth` and decrements, so a deeper entry carries a SMALLER
  // number — which is what makes the "deepest first" sort below a plain
  // ascending compare.
  remainingDepth: number
  target: "file" | "folder"
}

const toEntry = ({
  name,
  remainingDepth,
  sourcePath,
  target,
}: {
  name: string
  remainingDepth: number
  sourcePath: string
  target: "file" | "folder"
}): RenameEntry => ({
  fullPath: join(sourcePath, name),
  name,
  remainingDepth,
  target,
})

// Depth-limited walk that keeps folders as well as files. `getFilesAtDepth`
// drops the folders themselves, which is exactly the thing this command
// exists to rename. A folder is listed AFTER its own children so the
// deepest-first ordering falls out of the walk as well as the sort.
const listEntries = ({
  remainingDepth,
  sourcePath,
}: {
  remainingDepth: number
  sourcePath: string
}): Promise<RenameEntry[]> =>
  readdir(sourcePath).then((names) =>
    names.reduce<Promise<RenameEntry[]>>(
      (previousPromise, name) =>
        previousPromise.then((entries) =>
          stat(join(sourcePath, name)).then((stats) =>
            !stats.isDirectory()
              ? entries.concat([
                  toEntry({
                    name,
                    remainingDepth,
                    sourcePath,
                    target: "file",
                  }),
                ])
              : (remainingDepth > 0
                  ? listEntries({
                      remainingDepth: remainingDepth - 1,
                      sourcePath: join(sourcePath, name),
                    })
                  : Promise.resolve<RenameEntry[]>([])
                ).then((childEntries) =>
                  entries.concat(childEntries).concat([
                    toEntry({
                      name,
                      remainingDepth,
                      sourcePath,
                      target: "folder",
                    }),
                  ]),
                ),
          ),
        ),
      Promise.resolve<RenameEntry[]>([]),
    ),
  )

const compareEntries = (
  firstEntry: RenameEntry,
  secondEntry: RenameEntry,
) =>
  (firstEntry.target === secondEntry.target
    ? 0
    : firstEntry.target === "file"
      ? -1
      : 1) ||
  firstEntry.remainingDepth - secondEntry.remainingDepth ||
  firstEntry.fullPath.localeCompare(secondEntry.fullPath)

const isPathTaken = (candidatePath: string) =>
  stat(candidatePath).then(
    () => true,
    () => false,
  )

const renameOneEntry = ({
  entry,
  isDryRun,
  renameRegex,
}: {
  entry: RenameEntry
  isDryRun: boolean
  renameRegex: RenameRegex
}) =>
  ((renamedName: string) =>
    renamedName === entry.name ||
    renamedName.trim().length === 0
      ? of<RenameFilesAndFoldersRecord>({
          kind: "unchanged",
          source: entry.fullPath,
          target: entry.target,
        })
      : ((destination: string) =>
          from(isPathTaken(destination)).pipe(
            concatMap((isTaken) =>
              isTaken
                ? of<RenameFilesAndFoldersRecord>({
                    kind: "skipped",
                    reason: `A ${entry.target} already exists at ${destination}.`,
                    source: entry.fullPath,
                    target: entry.target,
                  })
                : isDryRun
                  ? of<RenameFilesAndFoldersRecord>({
                      destination,
                      isDryRun: true,
                      kind: "renamed",
                      source: entry.fullPath,
                      target: entry.target,
                    })
                  : from(
                      rename(entry.fullPath, destination),
                    ).pipe(
                      map(
                        (): RenameFilesAndFoldersRecord => ({
                          destination,
                          isDryRun: false,
                          kind: "renamed",
                          source: entry.fullPath,
                          target: entry.target,
                        }),
                      ),
                    ),
            ),
          ))(join(dirname(entry.fullPath), renamedName)))(
    applyRenameRegex(basename(entry.name), renameRegex),
  )

const logRenameSummary = ({
  isDryRun,
  records,
}: {
  isDryRun: boolean
  records: RenameFilesAndFoldersRecord[]
}) =>
  logInfo(
    "renameFilesAndFolders",
    `${
      records.filter((record) => record.kind === "renamed")
        .length
    } ${isDryRun ? "would rename" : "renamed"}, ${
      records.filter((record) => record.kind === "skipped")
        .length
    } skipped.`,
  )

export const renameFilesAndFolders = ({
  isDryRun = false,
  isRenamingFiles = true,
  isRenamingFolders = true,
  nameFilterRegex,
  recursiveDepth = 0,
  renameRegex,
  sourcePath,
}: RenameFilesAndFoldersProps) => {
  // Pre-validate every pattern once, synchronously, before the Observable
  // is built — same shape `copyFiles` and `renameFiles` use, so a bad flag
  // surfaces named at the call site rather than as a per-entry SyntaxError
  // halfway through a batch.
  const nameFilterCompiled = compileFilterRegex(
    nameFilterRegex,
    "nameFilterRegex",
  )
  validateRenameRegexChain(renameRegex)

  return defer(() =>
    from(
      listEntries({
        remainingDepth: recursiveDepth,
        sourcePath,
      }),
    ),
  ).pipe(
    map((entries) =>
      entries
        .filter((entry) =>
          entry.target === "file"
            ? isRenamingFiles
            : isRenamingFolders,
        )
        .filter(
          (entry) =>
            nameFilterCompiled === undefined ||
            nameFilterCompiled.test(entry.name),
        )
        .toSorted(compareEntries),
    ),
    concatMap((entries) =>
      from(entries).pipe(
        concatMap((entry) =>
          renameOneEntry({
            entry,
            isDryRun,
            renameRegex,
          }),
        ),
        toArray(),
      ),
    ),
    map((records) => {
      logRenameSummary({ isDryRun, records })
      return records
    }),
    logAndRethrowPipelineError(renameFilesAndFolders),
  )
}
