import { createReadStream, createWriteStream } from "node:fs"
import { stat, unlink } from "node:fs/promises"
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
 * Optional behavior toggles for `aclSafeCopyFile`. Pass `onProgress`
 * to receive byte-level updates as the copy streams through; omit
 * the options object entirely (the common case) to skip the progress
 * instrumentation and the upfront `stat` call it requires.
 *
 * Pass `signal` to make the copy abortable mid-stream — `pipeline`
 * destroys the read/write streams when the signal fires and the
 * returned promise rejects with an AbortError. Callers (e.g.
 * `copyFiles`, `flattenOutput`) wire this into a per-job
 * `AbortController` whose lifetime tracks the outer Observable, so
 * an unsubscribe (sequence cancel / sibling-fail cascade) interrupts
 * the in-flight copy instead of letting it finish.
 */
export type CopyOptions = {
  onProgress?: (event: CopyProgressEvent) => void
  signal?: AbortSignal
}

/**
 * Copies a single file's bytes from `source` to `destination` via a
 * stream pipeline. Equivalent to GNU `cp` without flags: data only,
 * no mode preservation, no timestamp preservation, no ownership
 * preservation.
 *
 * Built to work around an EPERM that `node:fs.copyFile` and
 * `node:fs.cp` hit on TrueNAS ZFS datasets configured with
 * `aclmode=restricted`. libuv's internal copyfile path calls
 * `fchmod()` on the destination after the data copy to preserve the
 * source's mode bits, and that chmod fails against NFSv4 ACLs even
 * when the mode is unchanged. Streaming the bytes never invokes
 * chmod, so the copy goes through.
 *
 * Files only — does not handle directory copies. The destination's
 * parent directory must already exist; callers are expected to
 * `mkdir`-recursive first (the underlying `createWriteStream` rejects
 * with ENOENT otherwise). Callers needing recursive copy should
 * compose with `readFilesAtDepth` and RxJS `mergeAll(cpus().length)`
 * the same way `syncAnimeDownloads` and `syncMangaFolders` already
 * do — that gives per-file concurrency control, observable progress,
 * and cancellation that a sequential walker cannot.
 *
 * Pass `options.onProgress` to receive per-chunk byte updates. When
 * omitted, the function takes a fast path that skips the upfront
 * `stat` call and the in-pipeline counting transform.
 */
// On abort, the destination is left as a half-written partial. The
// next run would either skip it (if same size by accident) or worse,
// be inspected by the user as if the copy had succeeded. Best-effort
// unlink of the partial: ignore ENOENT (file never opened) and any
// other unlink error — abort cleanup must not mask the original
// AbortError that the caller is about to receive.
const removePartialOnAbort = async (
  signal: AbortSignal | undefined,
  destination: string,
): Promise<void> => {
  if (signal === undefined || !signal.aborted) return
  try {
    await unlink(destination)
  } catch {
    // partial may not exist (createWriteStream lazy-opens) — ignore
  }
}

export const aclSafeCopyFile = async (
  source: string,
  destination: string,
  options?: CopyOptions,
): Promise<void> => {
  const signal = options?.signal

  if (
    !options?.onProgress
  ) {
    try {
      await pipeline(
        createReadStream(
          source,
        ),
        createWriteStream(
          destination,
        ),
        signal === undefined ? {} : { signal },
      )
      return
    } catch (error) {
      await removePartialOnAbort(signal, destination)
      throw error
    }
  }

  const onProgress = (
    options
    .onProgress
  )

  const { size: totalBytes } = (
    await (
      stat(
        source,
      )
    )
  )

  let bytesWritten = 0
  const progressTransform = (
    new Transform({
      transform(chunk, _encoding, callback) {
        bytesWritten += chunk.length
        onProgress({
          source,
          destination,
          bytesWritten,
          totalBytes,
        })
        callback(
          null,
          chunk,
        )
      },
    })
  )

  try {
    await pipeline(
      createReadStream(
        source,
      ),
      progressTransform,
      createWriteStream(
        destination,
      ),
      signal === undefined ? {} : { signal },
    )
  } catch (error) {
    await removePartialOnAbort(signal, destination)
    throw error
  }
}
