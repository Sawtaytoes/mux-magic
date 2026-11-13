# 2026-11-13 — File cleanup deletes only what it has confirmed

- **Status:** Accepted
- **Date:** 2026-11-13
- **Type:** core
- **Supersedes:** [2026-05-19 — Atomic copy + filesystem move](2026-05-19-atomic-copy-and-filesystem-move.md), in part: only the sentence that says the overwrite path unlinks the destination before the rename
- **Superseded by:** —
- **Source:** 2026-11-12 code audit (data-loss findings); the owner asked for all of its findings to be fixed

## Decision

A command that moves or cleans up files deletes nothing it has not confirmed is safe to lose:

- A move renames over the destination. It never deletes the destination first. Only on Windows, and only after a plain rename refused to replace the file, the old destination is renamed aside, and it is deleted after the new file is in place. A failed rename puts it back.
- `flattenOutput` and `flattenChildFolders` remove a folder with `rmdir`, so only an empty folder goes. A folder that still holds a nested subfolder or file is kept, and its leftover entries are logged as a warning.
- `deleteCopiedOriginals` checks each original against its copy before it deletes anything. The copy paths come from the copy step's `copiedDestinationPaths` output, in the same order as `copiedSourcePaths`. A missing copy, a size difference, or a missing list stops the step, and nothing is deleted.
- `deleteFolder` and `deleteCopiedOriginals` delete through `deletePath` in `tools/deleteFiles.ts`, so they get its path check and honor `DELETE_MODE` (trash by default).
- `renameFileOrFolder` treats only `ENOENT` as a free name, and claims the name before it renames, so two renames into one name cannot replace each other.

## Context

The audit found five ways these commands could lose data. `flattenOutput` and `flattenChildFolders` moved only top-level files and then ran a recursive `rm`, which deleted any nested subfolder. `deleteCopiedOriginals` and `deleteFolder` ran `rm -r` with no trash, no path check, and no check that a copy existed. `moveSingleFile` deleted the destination before the rename, so a failed rename lost the old file. `renameFileOrFolder` treated any `stat` error as "absent", and `nameAnimeEpisodes` renames at unlimited concurrency, so two files that mapped to one name could both rename, and the second replaced the first.

## What we rejected — DO NOT revert to this

- **Unlinking the destination before the rename.** On POSIX, `rename` already replaces the destination in one atomic step. Deleting it first only adds a window in which a failed rename loses both files' worth of data.
- **A recursive `rm` to clean up after a move.** A move that skips nested folders must not delete what it skipped.
- **Trusting a list of "copied" paths without checking the copies.** A list can be stale, typed by hand, or from a copy that failed part way.
- **`fs.rm` in an app command.** Deletes go through `deletePath`, so `DELETE_MODE` and the path check apply.

## Why

Each of these deletes media that has no other copy. A sequence that keeps a folder it could have removed costs a manual cleanup; a sequence that deletes a folder it should have kept costs the media.

## Evidence

- Regression tests: `flattenOutput.test.ts` and `flattenChildFolders.test.ts` (nested subfolder survives), `moveSingleFile.test.ts` (destination survives a failed rename and a failed cross-volume copy), `deleteCopiedOriginals.test.ts` (missing or short copy deletes nothing), `deleteFolder.test.ts` (trash by default), and `createRenameFileOrFolder.test.ts` (two concurrent renames into one name keep both files). Each failed against the code before this change.
- Existing sequences that link only `pathsToDelete` now stop at `deleteCopiedOriginals` with a message that names `copiedDestinationPaths`. Link that field to the same copy step to restore the cleanup.
