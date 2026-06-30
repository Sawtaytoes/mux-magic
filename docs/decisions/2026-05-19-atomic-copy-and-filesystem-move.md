# 2026-05-19 — Atomic copy + filesystem move (FICLONE, ZFS-EPERM, no temp on same-volume moves)

- **Status:** Accepted
- **Date decided:** 2026-05-19 (worker 59, PR #134, commits `6832906b` / `209c1170`); the "no temp file on same-volume moves" rule re-emphasized by the user 2026-06-29
- **Area:** core / tools
- **Source:** worker 59 (`atomic-copy-and-fast-move`); `packages/tools/src/aclSafeCopyFile.ts`, `packages/core/src/app-commands/moveFiles.ts`

## Decision

There are two distinct file operations with two distinct mechanisms. Do not collapse them.

### A move is `fs.rename` — no temp file on the same volume

A same-volume move is a single atomic `fs.rename(source, destination)`. **No temp file, no byte copy** — it's an O(1) metadata op, instant even on a 50 GB MKV. `moveFiles` (`moveSingleFile`) does exactly this and only falls back to a copy when the OS throws **`EXDEV`** (genuinely cross-volume — `rename` across volumes is impossible). On the overwrite path it `unlink`s the destination first (Windows `rename` errors `EPERM` over an existing file), then renames. `moveFilesIntoNamedFolders` and `flattenChildFolders` use the pure-rename `renameFileOrFolder` helper because their moves are same-volume by construction.

### A copy is atomic via temp + rename, with a kernel fast path

`aclSafeCopyFile` copies into a sibling `<destination>.muxmagic.tmp`, then `fs.rename`s it onto the real name. The temp exists **only here**, to give the copy crash-atomicity (a crash leaves an obviously-orphaned `.tmp`, never a half-written file under the real name). Two tiers:

1. **Kernel block-copy** — `fs.copyFile(src, tmp, COPYFILE_FICLONE)`. libuv routes to `copy_file_range`/`sendfile`/`CopyFileExW`; FICLONE requests a reflink on ZFS 2.2+/Btrfs/APFS and silently falls back to a normal block-copy elsewhere. This makes copies fast too — always tried first.
2. **Streaming copy** — read/write stream pipeline. Kept as the fallback for genuine partial writes only.

**The ZFS EPERM catch:** on TrueNAS ZFS with `aclmode=restricted`, libuv's post-copy `fchmod` fails `EPERM` against NFSv4 ACLs even though every byte landed. We catch that `EPERM`, verify `source.size === temp.size`, and treat it as **success** — falling through to the slow stream tier only when the sizes don't match (a real partial write). Without this catch, every copy on that NAS would wrongly take the slow path or fail.

### Other rules from this decision

- **Refuse to overwrite by default.** Both copy and move reject with an `EEXIST`-shaped error if the destination exists; callers opt into last-write-wins with `isOverwriteAllowed: true` (surfaced as `allowOverwrite` on `copyFiles`/`moveFiles`).
- **No `rm -r sourcePath`.** Worker 59 deleted the old end-of-run recursive wipe `moveFiles` used to run — it could destroy unrelated files in the source dir that didn't match the filter. Source cleanup belongs in `deleteFilesByExtension` / `deleteEmptyFolders` / `flattenChildFolders`, never bundled into a move.

## What we rejected — DO NOT revert to this

- **Do not route a same-volume move through the copy path / a temp file.** A move is `fs.rename`. Copying bytes (even a fast FICLONE reflink) plus deleting the source is slower, non-atomic, and wrong for a same-volume operation. This is the active bug in `flattenOutput`'s delete-originals path (see the follow-up worker) — it must move, not copy+delete.
- **Do not "simplify" the FICLONE EPERM handling away.** Treating that EPERM as a hard failure (or skipping the size-match check and always streaming) re-breaks fast copies on the TrueNAS ZFS dataset — the exact case this was built for.
- **Do not remove the temp-file atomicity from the copy path**, and do not delete the streaming-copy tier — it's the intentional fallback for partial writes / future use.
- **Do not re-add a trailing `rm -r sourcePath` to any move command.**
- **Do not flip the overwrite default to last-write-wins.** Opt-in only.

## Why it must not be re-litigated

These are the user's most-hit pain points: moves must be instant on the same volume, and copies must not crawl or fail on the ZFS NAS. Each guard (no-temp move, FICLONE-first, EPERM-as-success, refuse-overwrite, no rm -r) fixes a concrete, repeatedly-encountered failure. Reverting any of them silently reintroduces slowness or data loss. See also [NSF state lives in the filesystem](2026-05-19-nsf-filesystem-is-the-state.md) (its bucket moves depend on the fast same-volume rename).
