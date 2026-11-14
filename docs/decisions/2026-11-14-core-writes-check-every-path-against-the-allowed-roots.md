# 2026-11-14 — Core writes check every path against the allowed roots

- **Status:** Accepted
- **Date:** 2026-11-14
- **Type:** core
- **Supersedes:** [2026-11-13 — Browser writes are same-origin, and file changes stay under the allowed roots](2026-11-13-browser-writes-are-same-origin-and-file-changes-stay-under-allowed-roots.md), in part: only the sentence in its fourth bullet that says the command-parameter check "is a check on the parameters, not a sandbox", so a path a command builds or finds later is not checked
- **Superseded by:** —
- **Source:** 2026-11-12 code audit follow-up; the owner asked on 2026-11-14 for the root check to move into the core write code

## Decision

- Core moves, renames, deletes, and writes media only through `packages/core/src/tools/guardedFileWrites.ts`. It wraps `mkdir`, `open` (a writable open only), `rename`, `rm`, `rmdir`, `unlink`, `utimes`, and `writeFile` from `node:fs/promises`, and the `@mux-magic/tools` helpers `aclSafeCopyFile`, `aclSafeCopyFolder`, `makeDirectory`, `renameFileOrFolder`, and `renameOntoDestination`. Each wrapper keeps the signature of the function it wraps and checks every path it changes before anything on disk changes. A rename checks both its source and its destination.
- `FileInfo.renameFile`, which `getFiles` and `getFilesAtDepth` hand to the naming commands, renames through the tools package's own fs calls. Commands call `renameListedFile` in `guardedFileWrites.ts` instead. It builds the new path with the same rule (the new name joined to the file's folder, keeping the extension), checks both paths, and then calls `renameFile`. A refusal is logged and the file is skipped, as a failed rename already is. ESLint `no-restricted-syntax` refuses a direct `.renameFile(` or `.renameFolder(` call in core.
- The copy helpers compute paths of their own: the `.muxmagic.tmp` file beside each destination, and every file, folder, and link inside a copied folder. `aclSafeCopyFile` and `aclSafeCopyFolder` in `@mux-magic/tools` take an optional `assertWritablePath` option and call it on each of those paths before they touch it. Core passes the root check through it. The tools package still knows nothing about roots.
- The check is `assertWritePathInsideAllowedRoots` in `pathSafety.ts`. It uses the same roots as the API: `ALLOWED_FILE_ROOTS` when set, `/media` in the container image, and no limit in a source installation.
- When roots apply, a path that contains a `..` segment is refused, as the API refuses it. The system and a recursive mkdir walk the raw segments, so `/outside/new/../../media/child` could create `/outside/new` before it lands inside a root. Core builds its paths with `join`, which removes `..`, so only a hand-typed CLI path is affected.
- Links are resolved the way the operating system walks a path: one segment at a time, following each link as it is reached. A `..` inside a link target is taken as the parent of the folder reached so far. A link whose target does not exist yet is still followed. Only the host's separator splits a path, so on Linux a backslash stays part of a name. A link target, or a Buffer path argument, that is not valid UTF-8 is refused when roots apply, because decoding it would check a different path than the system opens. A trailing separator or `.` follows a link in the last segment, as the system does. Every link followed anywhere in one path counts against a single limit of 40, so links that expand into each other cannot cost exponential work. Every folder above the path that does not exist yet must be inside a root too, because a recursive mkdir creates it. That matters only when a root itself does not exist yet. When roots apply, a Windows drive-relative path (`C:file`) is refused, because it resolves against a per-drive working directory this process cannot see. Lexical normalization would check a link target `hop/..` as the link's own folder when `hop` links to `/outside/child`, where the system lands in `/outside`. `resolveExistingPath`, which the API's `validateWritablePath` uses, resolves the same way.
- Writes into a file's content (writing, copying onto, setting times, and the files that ffmpeg, mkvmerge, mkvextract, mkvpropedit, MakeMKV, and taglib write) resolve symbolic links in the whole path, so a link inside a root that points outside is refused. Operations on a directory entry (rename, delete, create a folder) resolve links in the parent folder only, because they change the link, not its target. A delete reached by walking through a linked folder that leads outside is refused.
- The external tools write their own output, so each spawn wrapper (`runFfmpeg`, `runMkvMerge`, `runMkvExtract`, `runMkvPropEdit`, `writeChaptersMkvMerge`, `runMakeMkvConExtract`) checks its output path before it starts the process. With `--split`, `runMkvMerge` also checks every numbered part (`name-001.mkv`) that already exists beside the output, because mkvmerge writes the parts instead of the output path. taglib saves are checked before `save()`.
- A refusal is a `PathSafetyError`. It fails the write the same way an fs error does: a command that stops on a failed write stops, and a spawn wrapper that logs a failed file and moves on does the same for a refused one.
- ESLint `no-restricted-imports` blocks those write functions in `packages/core/src` outside `guardedFileWrites.ts`. The app's own state files are listed as exceptions, because they live outside the media roots: the job records (`jobPersistence.ts`, `jobErrorStore.ts`), the anime offline database cache, the transcode temp store, and test fixtures.
- The parameter check before a command runs stays. It fails a bad parameter before any work starts.

## What changes for the CLI

- A source installation with no `ALLOWED_FILE_ROOTS` has no limit, so the CLI on a desktop behaves as before.
- Unlike the API's `validateWritablePath`, this check does not require an absolute path. The CLI accepts relative paths, so a relative path is resolved against the working directory and then checked. When roots apply, a CLI path with a `..` segment is refused, as the API refuses one.
- The CLI now obeys the roots when they apply. Inside the container (`IS_CONTAINERIZED=true`) a CLI command can change files only under `/media`, and a CLI with `ALLOWED_FILE_ROOTS` set can change files only under those roots.

## What we rejected — DO NOT revert to this

- **Checking only the command parameters.** A path a command builds while it runs (the parent folder `flattenOutput` writes into) or finds while it walks a tree (a file under a linked folder) never passes through that check.
- **Calling `validateWritablePath` at each write site.** Sixty-odd call sites are easy to miss, and a new command would not get the check. The wrappers plus the lint rule make the safe import the only one that passes lint.
- **Adding the check to `@mux-magic/tools`.** That package is published for other apps and knows nothing about this app's roots.
- **Normalizing a path with `resolve` or `join` before the link walk.** It collapses `..` before the walk sees where it leads.
- **Checking only the top-level destination of a copy.** A link already inside the destination folder, or a link at the temporary file path, would be written through.
- **Resolving links in the whole path for a rename or delete.** It would refuse to rename or delete a link that sits inside a root, though only the link changes.

## Known limits

- The check runs just before each write. A link that another process creates between the check and the write is not caught.
- The `--split` part check covers the numbered names that mkvmerge writes by default, the only form mux-magic uses. An output template or another split form would need its own check.
- The Windows path rules (drive-relative refusal, both separators) are covered by reasoning, not by a test on Windows.
- MakeMKV picks its own file names. `runMakeMkvConExtract` checks the destination folder, the expected name, and every `.mkv` already in that folder, but not a name MakeMKV creates that is not there yet. A new file is created inside the checked folder, so it stays inside the root.

## Why

The app deletes and renames media, and some commands compute paths from what they find on disk. The allowed roots only protect the files outside them if every write goes through the check, not only the paths a client names.

## Evidence

- Tests: `guardedFileWrites.test.ts` (no limit without roots, relative paths, writes through a file link, deletes through a folder link, renames across the root, the container default), `flattenOutput.test.ts` (a parent folder outside the root is refused for both copy and move, and the file is kept), `deleteFilesByExtension.test.ts` (a file reached through a folder link that leaves the root is kept), `spawnOutputAllowedRoots.test.ts` (each spawn wrapper refuses an output outside the roots without spawning, and a split refuses an existing part that links outside), and `renumberChapters.test.ts` (the scratch chapter XML in the OS temp folder still works). `guardedFileWrites.test.ts` also covers a link whose target does not exist yet, a `..` in the path, a `..` in a link target, the copy temporary file, a link inside a copied folder's destination, a writable `open`, and `renameListedFile` skipping a file found through a folder link that leaves the root.
