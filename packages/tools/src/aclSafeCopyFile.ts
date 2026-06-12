import {
  createReadStream,
  createWriteStream,
  constants as fsConstants,
} from "node:fs"
import {
  copyFile,
  rename,
  stat,
  unlink,
} from "node:fs/promises"
import { Transform } from "node:stream"
import { pipeline } from "node:stream/promises"

/**
 * Per-chunk progress notification fired while a single file is being
 * copied. `bytesWritten` accumulates monotonically up to `totalBytes`
 * across the lifetime of one file copy. `source`/`destination`
 * identify which file the event belongs to.
 */
export type CopyProgressEvent = {
  source: string
  destination: string
  bytesWritten: number
  totalBytes: number
}

/**
 * Optional behavior toggles for `aclSafeCopyFile`.
 *
 * `onProgress` receives byte-level updates while the streaming tier
 * runs. The kernel block-copy tier is a single syscall from Node's
 * view — no per-chunk callback exists, so a single completion event
 * is emitted instead.
 *
 * `signal` aborts the streaming tier mid-pipeline. The kernel tier
 * cannot be cancelled partway through (one syscall); an aborted
 * signal observed before/after Tier 1 still tears down correctly
 * (the temp is unlinked, no rename happens).
 *
 * `isOverwriteAllowed: true` opts into last-write-wins semantics. The
 * default refuses to clobber: if `destination` already exists the
 * function rejects with an `EEXIST`-shaped error before opening the
 * source. Callers that want mirror-sync / idempotent-re-run behavior
 * must opt in explicitly.
 */
export type CopyOptions = {
  onProgress?: (event: CopyProgressEvent) => void
  signal?: AbortSignal
  isOverwriteAllowed?: boolean
}

const TEMP_SUFFIX = ".muxmagic.tmp"

const hasErrorCode = (
  error: unknown,
  code: string,
): boolean =>
  error !== null &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: unknown }).code === code

// Best-effort cleanup — ignore ENOENT (already gone) and any other
// unlink error. Cleanup failures must not mask the primary error the
// caller is about to receive.
const safeUnlink = async (path: string) => {
  try {
    await unlink(path)
  } catch {
    // intentional swallow
  }
}

const buildExistsError = (destination: string) => {
  const error = new Error(
    `Refusing to overwrite existing destination: ${destination}`,
  ) as Error & { code: string }
  error.code = "EEXIST"
  return error
}

const ensureDestinationWritable = async (
  destination: string,
  isOverwriteAllowed: boolean,
) => {
  try {
    await stat(destination)
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return false
    throw error
  }
  if (!isOverwriteAllowed)
    throw buildExistsError(destination)
  return true
}

const streamTier = async ({
  source,
  destination,
  tempPath,
  options,
}: {
  source: string
  destination: string
  tempPath: string
  options: CopyOptions | undefined
}) => {
  const signal = options?.signal
  const onProgress = options?.onProgress

  if (onProgress === undefined) {
    await pipeline(
      createReadStream(source),
      createWriteStream(tempPath),
      signal === undefined ? {} : { signal },
    )
    return
  }

  const { size: totalBytes } = await stat(source)
  // The progress transform mutates a closed-over counter — same shape
  // the file had pre-refactor. Recomputing offsets per chunk would be
  // wasteful, and `let` is the established pattern here.
  let bytesWritten = 0
  const progressTransform = new Transform({
    transform(chunk, _encoding, callback) {
      bytesWritten += chunk.length
      onProgress({
        source,
        destination,
        bytesWritten,
        totalBytes,
      })
      callback(null, chunk)
    },
  })
  await pipeline(
    createReadStream(source),
    progressTransform,
    createWriteStream(tempPath),
    signal === undefined ? {} : { signal },
  )
}

// Tier 1: kernel block-copy via `fs.copyFile`. libuv routes this to
// `copy_file_range` / `sendfile` / `CopyFileExW` and `COPYFILE_FICLONE`
// requests a reflink on ZFS 2.2+/Btrfs/APFS (silent fallback to a
// regular block-copy elsewhere). Returns true when the bytes landed
// (including the recoverable-EPERM case where libuv's post-copy
// `fchmod` failed against NFSv4 ACLs but the file is complete).
// Returns false to signal "fall through to streaming tier". Throws
// for unrecoverable errors that streaming wouldn't fix (ENOSPC,
// EACCES, source ENOENT).
const kernelCopyTier = async (
  source: string,
  tempPath: string,
) => {
  try {
    await copyFile(
      source,
      tempPath,
      fsConstants.COPYFILE_FICLONE,
    )
    return true
  } catch (error) {
    if (hasErrorCode(error, "EPERM")) {
      // libuv's post-copy `fchmod` failed; bytes are already on disk.
      // Verify size match before accepting — a genuine partial write
      // still needs the streaming fallback.
      const [sourceStat, tempStat] = await Promise.all([
        stat(source),
        stat(tempPath).catch(() => null),
      ])
      if (
        tempStat !== null &&
        tempStat.size === sourceStat.size
      ) {
        return true
      }
      await safeUnlink(tempPath)
      return false
    }
    if (
      hasErrorCode(error, "ENOSPC") ||
      hasErrorCode(error, "ENOENT") ||
      hasErrorCode(error, "EACCES")
    ) {
      await safeUnlink(tempPath)
      throw error
    }
    await safeUnlink(tempPath)
    return false
  }
}

const emitCompletionEvent = async (
  source: string,
  destination: string,
  onProgress: (event: CopyProgressEvent) => void,
) => {
  const { size: totalBytes } = await stat(source)
  onProgress({
    source,
    destination,
    bytesWritten: totalBytes,
    totalBytes,
  })
}

// POSIX `rename` overwrites silently; Windows `rename` errors with
// EPERM against an existing file. When we know the destination is
// present (overwrite case), unlink first; ignore ENOENT in case
// something raced us to it.
const finalizeRename = async (
  tempPath: string,
  destination: string,
  hasExistingDestination: boolean,
) => {
  if (hasExistingDestination) {
    await unlink(destination).catch((error) => {
      if (hasErrorCode(error, "ENOENT")) return
      throw error
    })
  }
  await rename(tempPath, destination)
}

/**
 * Atomically copies a single file from `source` to `destination`.
 *
 * Pipeline: pre-flight existence check → byte copy into a sibling
 * `<destination>.muxmagic.tmp` (kernel block-copy fast path with
 * streaming fallback) → `fs.rename` onto the canonical name. Same-
 * volume rename is an atomic metadata op — observers either see the
 * old file or the complete new file, never a partial. A crash leaves
 * at most a clearly-orphaned `*.muxmagic.tmp`, never a half-written
 * file under the real destination name.
 *
 * The deterministic temp suffix is intentional: a leftover from a
 * crashed prior run is recognizable, and the next attempt overwrites
 * it before the rename (temps are inherently orphaned data, so this
 * is the desired recovery behavior).
 *
 * Built to work around an EPERM that libuv's `fs.copyFile` hits on
 * TrueNAS ZFS datasets configured with `aclmode=restricted` — the
 * post-copy `fchmod` fails against NFSv4 ACLs even when the mode is
 * unchanged. We treat "EPERM after a complete write" (verified by
 * source/destination size match) as success, and only fall through to
 * a streaming pipeline for genuine partial writes.
 *
 * Files only — does not handle directory copies. The destination's
 * parent directory must already exist; callers are expected to
 * `mkdir`-recursive first.
 */
export const aclSafeCopyFile = async (
  source: string,
  destination: string,
  options?: CopyOptions,
): Promise<void> => {
  const isOverwriteAllowed =
    options?.isOverwriteAllowed === true
  const hasExistingDestination =
    await ensureDestinationWritable(
      destination,
      isOverwriteAllowed,
    )

  const tempPath = destination.concat(TEMP_SUFFIX)
  const signal = options?.signal
  const onProgress = options?.onProgress

  try {
    // Always try the kernel block-copy first — it's dramatically
    // faster, and the streaming tier loses the speedup just to
    // animate a progress bar mid-file. When `onProgress` is set we
    // still want kernel-tier; the bar simply ticks per-file (one
    // completion event) instead of per-chunk.
    const isKernelCopyDone = await kernelCopyTier(
      source,
      tempPath,
    )

    if (!isKernelCopyDone) {
      await streamTier({
        source,
        destination,
        tempPath,
        options,
      })
    } else if (onProgress !== undefined) {
      await emitCompletionEvent(
        source,
        destination,
        onProgress,
      )
    }

    // Abort observed between byte-copy and rename: don't install a
    // freshly-written temp onto the canonical path. The single-
    // syscall kernel tier can't be interrupted mid-copy, so this is
    // the post-copy abort window.
    if (signal?.aborted === true) {
      await safeUnlink(tempPath)
      throw signal.reason instanceof Error
        ? signal.reason
        : new Error("aborted")
    }

    await finalizeRename(
      tempPath,
      destination,
      hasExistingDestination,
    )
  } catch (error) {
    await safeUnlink(tempPath)
    throw error
  }
}
