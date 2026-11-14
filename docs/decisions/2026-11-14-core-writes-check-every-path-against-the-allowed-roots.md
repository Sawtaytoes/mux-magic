# 2026-11-14 — Core writes check every path against the allowed roots

- **Status:** Accepted
- **Date:** 2026-11-14
- **Type:** core
- **Supersedes:** [2026-11-13 — Browser writes are same-origin, and file changes stay under the allowed roots](2026-11-13-browser-writes-are-same-origin-and-file-changes-stay-under-allowed-roots.md), in part: only the sentence in its fourth bullet that says the command-parameter check "is a check on the parameters, not a sandbox", so a path a command builds or finds later is not checked
- **Superseded by:** —
- **Source:** 2026-11-12 code audit follow-up; the owner asked on 2026-11-14 for the root check to move into the core write code

## Decision

- Core moves, renames, deletes, and writes media only through `packages/core/src/tools/guardedFileWrites.ts`. It wraps `mkdir`, `rename`, `rm`, `rmdir`, `unlink`, `utimes`, and `writeFile` from `node:fs/promises`, and the `@mux-magic/tools` helpers `aclSafeCopyFile`, `aclSafeCopyFolder`, `makeDirectory`, `renameFileOrFolder`, and `renameOntoDestination`. Each wrapper keeps the signature of the function it wraps and checks every path it changes before anything on disk changes. A rename checks both its source and its destination.
- The check is `assertWritePathInsideAllowedRoots` in `pathSafety.ts`. It uses the same roots as the API: `ALLOWED_FILE_ROOTS` when set, `/media` in the container image, and no limit in a source installation.
- Writes into a file's content (writing, copying onto, setting times, and the files that ffmpeg, mkvmerge, mkvextract, mkvpropedit, MakeMKV, and taglib write) resolve symbolic links in the whole path, so a link inside a root that points outside is refused. Operations on a directory entry (rename, delete, create a folder) resolve links in the parent folder only, because they change the link, not its target. A delete reached by walking through a linked folder that leads outside is refused.
- The external tools write their own output, so each spawn wrapper (`runFfmpeg`, `runMkvMerge`, `runMkvExtract`, `runMkvPropEdit`, `writeChaptersMkvMerge`, `runMakeMkvConExtract`) checks its output path before it starts the process. taglib saves are checked before `save()`.
- A refusal is a `PathSafetyError`. It fails the write the same way an fs error does: a command that stops on a failed write stops, and a spawn wrapper that logs a failed file and moves on does the same for a refused one.
- ESLint `no-restricted-imports` blocks those write functions in `packages/core/src` outside `guardedFileWrites.ts`. The app's own state files are listed as exceptions, because they live outside the media roots: the job records (`jobPersistence.ts`, `jobErrorStore.ts`), the anime offline database cache, the transcode temp store, and test fixtures.
- The parameter check before a command runs stays. It fails a bad parameter before any work starts.

## What changes for the CLI

- A source installation with no `ALLOWED_FILE_ROOTS` has no limit, so the CLI on a desktop behaves as before.
- Unlike the API's `validateWritablePath`, this check does not require an absolute path or refuse `..`. The CLI accepts relative paths, so a relative path is resolved against the working directory and then checked.
- The CLI now obeys the roots when they apply. Inside the container (`IS_CONTAINERIZED=true`) a CLI command can change files only under `/media`, and a CLI with `ALLOWED_FILE_ROOTS` set can change files only under those roots.

## What we rejected — DO NOT revert to this

- **Checking only the command parameters.** A path a command builds while it runs (the parent folder `flattenOutput` writes into) or finds while it walks a tree (a file under a linked folder) never passes through that check.
- **Calling `validateWritablePath` at each write site.** Sixty-odd call sites are easy to miss, and a new command would not get the check. The wrappers plus the lint rule make the safe import the only one that passes lint.
- **Adding the check to `@mux-magic/tools`.** That package is published for other apps and knows nothing about this app's roots.
- **Resolving links in the whole path for a rename or delete.** It would refuse to rename or delete a link that sits inside a root, though only the link changes.

## Why

The app deletes and renames media, and some commands compute paths from what they find on disk. The allowed roots only protect the files outside them if every write goes through the check, not only the paths a client names.

## Evidence

- Tests: `guardedFileWrites.test.ts` (no limit without roots, relative paths, writes through a file link, deletes through a folder link, renames across the root, the container default), `flattenOutput.test.ts` (a parent folder outside the root is refused for both copy and move, and the file is kept), `deleteFilesByExtension.test.ts` (a file reached through a folder link that leaves the root is kept), and `spawnOutputAllowedRoots.test.ts` (each spawn wrapper refuses an output outside the roots without spawning).
