# Worker 59 — atomic-copy-and-fast-move

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/59-atomic-copy-and-fast-move`
**Worktree:** `.claude/worktrees/59_atomic-copy-and-fast-move/`
**Phase:** 4
**Depends on:** 01 (done)
**Soft-depends on:** 66 (done — `renameFiles` calls the same primitive once the helper lands), 40 (ready — `flattenChildFolders` / `distributeFolderToSiblings` inherit the safer copy automatically)
**Parallel with:** any worker that doesn't touch [packages/tools/src/aclSafeCopyFile.ts](../../packages/tools/src/aclSafeCopyFile.ts), [packages/core/src/app-commands/copyFiles.ts](../../packages/core/src/app-commands/copyFiles.ts), or [packages/core/src/app-commands/moveFiles.ts](../../packages/core/src/app-commands/moveFiles.ts).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Context

Two related foot-guns in today's file-movement primitives, both surfaced by real user pain:

**(1) Silent overwrite of an existing destination.** `aclSafeCopyFile` writes straight to `destination` via `createWriteStream`, which truncates whatever's already there. If a sequence accidentally lands on a directory with an existing file of the same name, that file is gone with no warning. The `aclSafeCopyFile` test `"overwrites an existing destination"` ([aclSafeCopyFile.test.ts:28-44](../../packages/tools/src/aclSafeCopyFile.test.ts#L28-L44)) is the behavior we want to flip — overwrites should be a deliberate opt-in, not the default.

**(2) Crash leaves a half-written file under the real name.** `aclSafeCopyFile` already best-effort-unlinks the partial on **abort** ([aclSafeCopyFile.ts:74-84](../../packages/tools/src/aclSafeCopyFile.ts#L74-L84)), but not on process crash / `kill -9` / power loss. A later run sees a real-looking file at the destination path and has no way to tell it's incomplete. The classic fix: stream into a sibling `*.tmp` file, then `fs.rename` it onto the canonical name only after the stream successfully closes. Same-volume `rename` is an atomic metadata op — observers either see the old file or the complete new file, never a partial. A crash leaves a clearly-orphaned `*.tmp` next to the destination instead of polluting the real path.

**(3) `moveFiles` copy-then-delete is slow.** [moveFiles.ts:46-223](../../packages/core/src/app-commands/moveFiles.ts) reads every byte of every file through `aclSafeCopyFile` and then `rm -r`s the source directory. For same-volume moves this is wasted I/O — `fs.rename` would do it in O(1) per file. EXDEV is the only reason to ever stream bytes. User's exact ask: *"is there a way to move files without doing a copy and delete? Because the copy+delete is very slow."*

Worker scope folds all three into one PR because they share plumbing (`fs.rename`) and the same caller surface.

## Your Mission

Make `aclSafeCopyFile` atomic by default (temp + rename), make it refuse to overwrite by default, and short-circuit same-volume moves in `moveFiles` to a pure `fs.rename`.

### Part A — atomic `aclSafeCopyFile`

Update [packages/tools/src/aclSafeCopyFile.ts](../../packages/tools/src/aclSafeCopyFile.ts):

```ts
export type CopyOptions = {
  onProgress?: (event: CopyProgressEvent) => void
  signal?: AbortSignal
  /**
   * When true, overwrite an existing file at `destination`. Default
   * false — if `destination` already exists the function rejects with
   * an `EEXIST`-shaped error before opening the source. Callers that
   * want last-write-wins semantics (mirror-sync, idempotent re-runs)
   * must opt in explicitly.
   */
  allowOverwrite?: boolean
}
```

Pipeline:

1. **Pre-flight existence check.** `await stat(destination)` — if it resolves and `allowOverwrite !== true`, reject with `Error("Refusing to overwrite existing destination: " + destination)` and a `code: "EEXIST"` property so callers can branch on it. If it rejects with `ENOENT`, proceed.
2. Compute a temp path: `destination + ".muxmagic.tmp"`. Suffix is unique enough to avoid collisions with user-authored `*.tmp` files (the codebase doesn't otherwise produce `*.muxmagic.tmp`). The suffix is intentionally NOT randomized — a leftover from a crashed prior run at the same destination is recognizable and would be overwritten by the next attempt (which is desirable: temps are inherently orphaned data).
3. Stream bytes from `source` to the temp path (existing pipeline body, unchanged).
4. After the pipeline resolves, `fs.rename(tempPath, destination)`. If `allowOverwrite` was true and the destination existed at step 1, the rename will overwrite it atomically on POSIX; on Windows, `fs.rename` errors with `EPERM` against an existing file, so when `allowOverwrite` is true we must `await unlink(destination).catch(ignore-enoent)` before the rename.
5. On any error (signal abort, stream error, rename error), `unlink` the temp file best-effort and propagate the original error. Reuse the existing `removePartialOnAbort` helper, generalized to take the temp path instead of the destination.

The progress-tracking fast path stays — only the destination changes from `destination` to `tempPath` inside the pipeline call.

**Important behavior preservation:** the existing test at [aclSafeCopyFile.test.ts:28-44](../../packages/tools/src/aclSafeCopyFile.test.ts#L28-L44) currently asserts overwrite-by-default. Update it to:

- Default-no-overwrite: source + existing target → reject with EEXIST shape, target's "stale bytes" are still present, source untouched, no `*.muxmagic.tmp` left behind.
- Explicit `allowOverwrite: true`: source + existing target → resolves, target now has "fresh bytes", no temp left behind.

Add new tests:

- Successful copy leaves no `*.muxmagic.tmp` (verify via `vol.toJSON()`).
- Mid-pipeline error (mock `createWriteStream` to error after some chunks) leaves no temp and no destination.
- Abort mid-stream leaves no temp and no destination.
- Stale temp from a prior run at the same target path is overwritten cleanly when `allowOverwrite: false` and the real destination doesn't exist.

### Part B — `moveFiles` same-volume fast-path

Update [packages/core/src/app-commands/moveFiles.ts](../../packages/core/src/app-commands/moveFiles.ts):

1. For each file, attempt `fs.rename(file.fullPath, destinationFilePath)` first.
2. If it succeeds, emit the move record and skip the byte stream entirely. Log `MOVED` instead of `COPIED`.
3. If it rejects with `code === "EXDEV"` (cross-volume), fall back to the existing `aclSafeCopyFile` + per-file `unlink(file.fullPath)` path. **The per-file unlink replaces the end-of-run `rm -r sourcePath`** — see Part C below.
4. If it rejects with anything else (EACCES, EEXIST, ENOENT), propagate. EEXIST in particular: same overwrite semantics as Part A — accept an `allowOverwrite` parameter on `moveFiles` (default false) and only `unlink(destinationFilePath)` before the rename if the user opted in.

The `makeDirectory(destinationPath)` step still runs once per file (cheap when already exists); both the rename fast-path and the EXDEV fallback need the directory present.

Progress events: rename has no byte-level progress (it's metadata-only). Emit `tracker.reportBytes(size)` once on rename success so the progress bar still completes, then `tracker.finish(size)`. The EXDEV fallback retains per-chunk progress as today.

### Part D — restore the block-copy fast path

Pre-context: `aclSafeCopyFile` was originally written ([aclSafeCopyFile.ts:47-53](../../packages/tools/src/aclSafeCopyFile.ts#L47-L53)) to work around an EPERM that `fs.copyFile` / `fs.cp` hit on TrueNAS ZFS datasets with `aclmode=restricted`. libuv's `uv__fs_copyfile` does the actual byte copy via `copy_file_range` / `sendfile` / `CopyFileExW` (very fast — often kernel-side, supports reflinks on ZFS/Btrfs/APFS), then calls `fchmod` on the destination to preserve source mode bits. The chmod is what fails against NFSv4 ACLs, even when the mode wouldn't actually change. Streaming was the workaround, but it gave up the kernel block-copy entirely. Result: every copy now reads + writes every byte through Node, which is what makes the current `moveFiles` and `copyFiles` slow.

The chmod is the **last** operation in libuv's copy path. By the time it fails, the bytes have already been copied to the destination and the file descriptor is about to close. We can recover the fast path by treating "EPERM after a complete write" as a non-error.

Two-tier strategy inside `aclSafeCopyFile`:

1. **Tier 1, kernel block-copy:**

   ```ts
   try {
     await fsPromises.copyFile(source, tempPath, fsConstants.COPYFILE_FICLONE)
   } catch (error) {
     if (error.code === "EPERM") {
       // libuv's post-copy fchmod failed. Verify the bytes landed
       // (size match) — if yes, treat as success; if no, fall through
       // to the streaming tier.
       const [srcStat, dstStat] = await Promise.all([
         stat(source),
         stat(tempPath).catch(() => null),
       ])
       if (dstStat !== null && dstStat.size === srcStat.size) {
         // accept; proceed to rename
       } else {
         await unlink(tempPath).catch(ignoreEnoent)
         throw error // fall through handled by outer try
       }
     } else {
       throw error
     }
   }
   ```

   `COPYFILE_FICLONE` (not `COPYFILE_FICLONE_FORCE`) requests a reflink on supporting filesystems and silently falls back to a regular block copy elsewhere — best of both. ZFS reflink support is post-OpenZFS 2.2; older datasets just get plain block-copy, which is still much faster than streaming.

2. **Tier 2, streaming fallback** (existing pipeline body): runs only if Tier 1 throws something other than the recoverable EPERM, or if the post-EPERM size check fails (genuine partial write).

`onProgress` semantics: the kernel block-copy is atomic from Node's view — there's no per-chunk callback to hook into. When `onProgress` is supplied, emit a single `bytesWritten === totalBytes` event after the copy completes (same shape the progress emitter expects for completion). When the streaming fallback is taken, the existing per-chunk progress applies as today. The progress emitter in `moveFiles` / `copyFiles` already handles a one-shot completion event correctly (see Part B's rename fast-path discussion — same pattern).

Abort handling: `fs.copyFile` doesn't accept an `AbortSignal`. For Tier 1 we accept the small race window — the kernel copy can't be interrupted partway through, so an in-flight abort just waits for the syscall to return, then the rename is skipped and the temp is unlinked. For very large files where mid-copy cancellation matters, callers can pass an option to force the streaming tier (or we add `forceStream?: boolean` to `CopyOptions` — defer until a real use case appears).

Tier-1 test additions:

- Verify `fs.copyFile` is called and the streaming pipeline is NOT, in the happy path.
- Mock `fs.copyFile` to throw `{ code: "EPERM" }` after writing the full file (memfs setup with matching size) → success, no streaming tier invoked.
- Mock `fs.copyFile` to throw `{ code: "EPERM" }` with destination size 0 (genuine fail) → streaming tier runs and completes.
- Mock `fs.copyFile` to throw `{ code: "ENOSPC" }` → propagate without trying the streaming tier (no point — same disk).

Risk note: this changes the fast-path for **every** copy in the codebase. The two test environments to verify against are (a) Windows local dev (the user's primary box — `CopyFileExW` path), and (b) TrueNAS ZFS write target (the original motivating ACL case — confirm the EPERM-recovery branch fires and produces an intact file).

### Part C — drop the `rm -r sourcePath` at the end of `moveFiles`

Today's [moveFiles.ts:200-209](../../packages/core/src/app-commands/moveFiles.ts#L200-L209) blows away the entire `sourcePath` directory after all copies finish. This is dangerous: if the source dir contains unrelated files that didn't match `fileFilterRegex`, they're lost. With per-file `unlink` (for the EXDEV path) and `fs.rename` removing the source entry implicitly (for the fast path), the trailing `rm -r` is no longer needed and was always a hazard. Drop it.

If the user wants the source directory removed after a move, that's the existing `deleteFilesByExtension` + `deleteEmptyFolders` chain (or worker 40's `flattenChildFolders` for the parent's case). Don't bundle directory deletion into `moveFiles`.

This is a behavior change visible to anyone whose sequence relied on the implicit source-dir wipe. Document in the worker PR and the existing `moveFiles.test.ts` will need its assertions updated for the new "files moved, source dir still exists (now empty of matched files)" reality.

## Files

### Modified

- `packages/tools/src/aclSafeCopyFile.ts` — temp+rename body, `allowOverwrite` option.
- `packages/tools/src/aclSafeCopyFile.test.ts` — flip the overwrite-default test, add temp/abort/error cleanup tests.
- `packages/core/src/app-commands/copyFiles.ts` — thread `allowOverwrite` through the schema (default false) into the `aclSafeCopyFile` call. New schema field `allowOverwrite: z.boolean().default(false)`.
- `packages/core/src/app-commands/copyFiles.test.ts` — add a "rejects on existing destination" test and an "overwrites when allowOverwrite: true" test.
- `packages/core/src/app-commands/moveFiles.ts` — rename fast-path + EXDEV fallback, drop `rm -r sourcePath`, pass `allowOverwrite` through to `aclSafeCopyFile`.
- `packages/core/src/app-commands/moveFiles.test.ts` — add a same-volume rename test (verify no stream pipeline runs — spy on `aclSafeCopyFile`), an EXDEV fallback test (mock `fs.rename` to throw EXDEV), and update assertions that depended on `sourcePath` being wiped.
- `packages/api/src/api/schemas.ts` — add `allowOverwrite` to `copyFilesRequestSchema` and `moveFilesRequestSchema` (default false, optional).
- `packages/web/src/commands/commands.ts` — surface `allowOverwrite` on both `copyFiles` and `moveFiles` cards as a boolean field labeled "Allow overwrite". Default off. Tooltip explains the new fail-fast behavior.
- `packages/cli/src/cli-commands/copyFilesCommand.ts` + `moveFilesCommand.ts` — add `--allow-overwrite` flag.
- `packages/web/public/command-descriptions.js` — update `copyFiles` and `moveFiles` descriptions to mention the new safety default.
- `docs/workers/MANIFEST.md` — flip to `in-progress` at start, `done` after PR merge.

### New

None. Pure modification.

### Pattern templates to mirror

- Temp+rename idiom (POSIX): write to sibling `<name>.muxmagic.tmp`, then `rename` onto canonical name. Standard `write_atomic` pattern; no library dependency.
- EXDEV fallback shape → match the existing `aclSafeCopyFile` ACL-EPERM workaround: try the fast syscall, catch the known error class, fall back to the streaming path.
- `copyFiles` AbortController wrap → already correct, keep as-is. The same controller covers both the rename attempt and the streaming fallback in `moveFiles`.

## TDD steps

1. **Helper test, no-overwrite default**: source + existing target → rejects with EEXIST shape; target bytes unchanged; no temp left behind.
2. **Helper test, explicit overwrite**: same setup + `allowOverwrite: true` → resolves; target bytes replaced; no temp left behind.
3. **Helper test, mid-pipeline error**: mock `createWriteStream` to emit an error after one chunk → reject; no temp; no destination created.
4. **Helper test, abort mid-stream**: existing abort test updated for temp-path cleanup.
5. **Helper test, stale temp recovered**: pre-seed `dest.muxmagic.tmp` + missing real `dest` → copy succeeds, both temp and real dest end up correct (the new write overwrites the orphan temp before the rename).
6. **copyFiles test, no-overwrite default**: directory of 5 files, 1 destination already exists → command errors before any copies happen; no partials anywhere.
7. **copyFiles test, allow-overwrite**: same setup + flag → all 5 copies land, the prior file is replaced.
8. **moveFiles test, same-volume fast-path**: spy on `aclSafeCopyFile` and assert it was NOT called; spy on `fs.rename` and assert it WAS; verify destination has the bytes and source no longer has the file.
9. **moveFiles test, EXDEV fallback**: mock `fs.rename` to throw `{ code: "EXDEV" }` on the first call → `aclSafeCopyFile` runs, per-file `unlink` removes the source.
10. **moveFiles test, sourcePath dir preserved**: pre-seed source dir with a filtered-out file (e.g. matching exclusion) → after move, the filtered-out file is still there and the source dir still exists.
11. **Route/CLI smoke**: POST `/api/copyFiles` with an existing target → 4xx-shaped error response carrying the EEXIST message; same call with `allowOverwrite: true` → 200.
12. **Manual web smoke**: build a 2-step sequence (`copyFiles` into a populated dir) → run → expect the error toast naming the colliding file. Flip the new `allowOverwrite` field on → re-run → expect success. Repeat with `moveFiles`. Also: same-disk `moveFiles` of a large file (~1GB) should complete in well under a second (proves the rename fast-path).

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests written first
- [ ] `aclSafeCopyFile` writes to `*.muxmagic.tmp` and renames on success
- [ ] `aclSafeCopyFile` rejects with EEXIST shape when destination exists and `allowOverwrite` is not set
- [ ] All error paths (mid-stream, abort, rename failure) unlink the temp
- [ ] `copyFiles` exposes `allowOverwrite` (schema + UI + CLI)
- [ ] `moveFiles` uses `fs.rename` on same volume; falls back to copy+unlink on EXDEV
- [ ] `moveFiles` no longer `rm -r`s `sourcePath`; per-file `unlink` only
- [ ] All existing app-command tests pass after assertion updates
- [ ] Manual smoke per TDD step 12 (including the 1GB same-disk move)
- [ ] Standard pre-merge gate clean: `yarn lint → typecheck → test → e2e → lint`
- [ ] PR opened against `feat/mux-magic-revamp`
- [ ] Manifest row → `done`

## Out of scope

- **Generalized atomic-write helper outside the copy path.** YAML / template writes (e.g. server template storage from worker 2a) could also benefit from temp+rename, but that's a separate sweep — this worker is scoped to `aclSafeCopyFile` and its two direct callers.
- **Configurable temp suffix.** The hardcoded `.muxmagic.tmp` is fine; user-configurable suffixes would just create options nobody uses.
- **Cross-volume `moveFiles` performance.** The EXDEV path still pays full streaming cost — that's inherent to the filesystem layout. Concurrent per-file copies (worker 11's task scheduler already handles this) is the existing mitigation.
- **Three-way merge on collision** (skip / overwrite / rename-with-suffix). Halt-and-tell-the-user is the chosen design — collisions are usually a sign the sequence's filter is wrong, not a thing to silently paper over. A future worker can add `onCollision: "skip" | "rename" | "error"` if a real workflow needs it.
- **Verifying `*.muxmagic.tmp` orphans from prior crashed runs.** A cleanup pass that finds and removes them belongs in a separate "stale temp sweeper" worker, not inline with every copy.
- **`renameFiles` (worker 66, already done).** Pure in-place rename doesn't go through `aclSafeCopyFile` — it uses `FileInfo.renameFile` which is already a `fs.rename`. No changes needed there.
- **`replaceAttachmentsMkvMerge` and other mkvmerge / ffmpeg output paths.** Those write through subprocesses that we don't control. Wrapping their outputs in temp+rename is a different worker (the subprocess writes to a temp arg, we rename after exit).
