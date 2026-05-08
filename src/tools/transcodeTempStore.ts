import { createHash } from "node:crypto"
import {
  mkdirSync,
  rmSync,
  statSync,
} from "node:fs"
import {
  rm,
  stat,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Persistent on-disk LRU cache of audio-transcoded copies, keyed on the
// source path + the encode parameters. Lives under
// `os.tmpdir()/media-tools-transcode-cache/`.
//
// The cache key is hashed (sha-256, hex) so the on-disk filename is
// always safe regardless of source-path content. The file extension is
// chosen by codec (`.webm` for opus, `.mp4` for aac) so a file manager
// peeking at `os.tmpdir()` shows recognizable types.
//
// Refcounting model:
//   - `acquire()` increments the entry's refCount and (if not present)
//     records its tempPath. Callers MUST call `release()` after they're
//     done streaming the file so the LRU evictor can reclaim space.
//   - `markReady()` records the on-disk size after the encode completes,
//     so the size-cap evictor knows what each entry costs.
//   - The evictor only ever deletes entries whose refCount === 0 AND
//     whose markReady() has been called. A half-written entry (encoder
//     still running) is unsafe to remove regardless of refCount.
//
// Eviction policy: bytes-on-disk LRU. When the post-add total exceeds
// `maxTotalBytes`, evict oldest-by-lastAccess until we're back under.
// Default cap is 4 GB (per design doc §5/§10) and overridable via the
// `TRANSCODE_CACHE_MAX_BYTES` env var.

export type TranscodeCodec = "opus" | "aac"

export type TranscodeCacheKey = {
  absPath: string
  audioStream: number
  bitrate: string
  codec: TranscodeCodec
}

type CacheEntry = {
  hashedKey: string
  isReady: boolean
  lastAccess: number
  refCount: number
  sizeBytes: number
  tempPath: string
}

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024 * 1024

const parseMaxBytes = (): number => {
  const fromEnv = process.env.TRANSCODE_CACHE_MAX_BYTES
  if (typeof fromEnv !== "string" || fromEnv.length === 0) {
    return DEFAULT_MAX_BYTES
  }
  const parsed = Number(fromEnv)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_MAX_BYTES
  }
  return parsed
}

const cacheDirectoryPath = (): string => (
  join(tmpdir(), "media-tools-transcode-cache")
)

let isCacheDirectoryEnsured = false
const ensureCacheDirectory = (): string => {
  const directoryPath = cacheDirectoryPath()
  if (!isCacheDirectoryEnsured) {
    mkdirSync(directoryPath, { recursive: true })
    isCacheDirectoryEnsured = true
  }
  return directoryPath
}

const extensionForCodec = (codec: TranscodeCodec): string => (
  codec === "opus"
  ? ".webm"
  : ".mp4"
)

export const mimeTypeForCodec = (codec: TranscodeCodec): string => (
  codec === "opus"
  ? "video/webm"
  : "video/mp4"
)

const hashKey = (key: TranscodeCacheKey): string => (
  createHash("sha256")
  .update(key.absPath)
  .update("|")
  .update(key.codec)
  .update("|")
  .update(key.bitrate)
  .update("|")
  .update(String(key.audioStream))
  .digest("hex")
)

const buildTempPath = (key: TranscodeCacheKey): string => {
  const directoryPath = ensureCacheDirectory()
  const hashed = hashKey(key)
  return join(directoryPath, `${hashed}${extensionForCodec(key.codec)}`)
}

const entries = new Map<string, CacheEntry>()
let maxTotalBytes: number = parseMaxBytes()

const evictIfOverCap = async (): Promise<void> => {
  const currentTotal = (
    Array
    .from(entries.values())
    .reduce(
      (total, entry) => (
        entry.isReady
        ? total + entry.sizeBytes
        : total
      ),
      0,
    )
  )
  if (currentTotal <= maxTotalBytes) {
    return
  }
  // Sort idle (refCount === 0) ready entries by lastAccess ascending so
  // the oldest go first.
  const evictionCandidates = (
    Array
    .from(entries.values())
    .filter((entry) => (
      entry.isReady
      && entry.refCount === 0
    ))
    .sort((left, right) => left.lastAccess - right.lastAccess)
  )
  let runningTotal = currentTotal
  // Use a plain index walk via reduce so we stay within the AGENTS.md
  // "no for loops" rule. Each iteration deletes one entry until we're
  // under cap or out of candidates.
  await evictionCandidates
  .reduce<Promise<void>>(
    (previous, entry) => (
      previous
      .then(async () => {
        if (runningTotal <= maxTotalBytes) {
          return
        }
        try {
          await rm(entry.tempPath, { force: true })
        }
        catch {
          // best-effort eviction; if the file is already gone we can
          // still drop the in-memory bookkeeping.
        }
        entries.delete(entry.hashedKey)
        runningTotal -= entry.sizeBytes
      })
    ),
    Promise.resolve(),
  )
}

export const transcodeTempStore = {
  // Returns the on-disk path the caller should target for the encoded
  // output, AND increments the entry's refcount so concurrent requests
  // for the same key share the same in-flight or completed file. The
  // returned `isFresh` flag is `true` when this caller is the first to
  // acquire — i.e. responsible for spawning the ffmpeg encode.
  acquire: (key: TranscodeCacheKey): {
    isFresh: boolean
    tempPath: string
  } => {
    const hashed = hashKey(key)
    const existing = entries.get(hashed)
    if (existing) {
      existing.refCount += 1
      existing.lastAccess = Date.now()
      return { isFresh: false, tempPath: existing.tempPath }
    }
    const tempPath = buildTempPath(key)
    const entry: CacheEntry = {
      hashedKey: hashed,
      isReady: false,
      lastAccess: Date.now(),
      refCount: 1,
      sizeBytes: 0,
      tempPath,
    }
    entries.set(hashed, entry)
    return { isFresh: true, tempPath }
  },

  // Records the encoded file's on-disk size and flips the entry to ready
  // so subsequent acquire() calls treat it as a cache hit and the LRU
  // evictor can include it in size accounting. Falls back to stat()'ing
  // the file when the caller doesn't already know the size.
  markReady: async (key: TranscodeCacheKey): Promise<void> => {
    const hashed = hashKey(key)
    const entry = entries.get(hashed)
    if (!entry) {
      return
    }
    let sizeBytes = 0
    try {
      const stats = await stat(entry.tempPath)
      sizeBytes = stats.size
    }
    catch {
      // If the file vanished between encode-completion and markReady,
      // drop the bookkeeping entirely so a retry can re-encode cleanly.
      entries.delete(hashed)
      return
    }
    entry.sizeBytes = sizeBytes
    entry.isReady = true
    entry.lastAccess = Date.now()
    await evictIfOverCap()
  },

  // Decrements the refcount. When the entry is still mid-encode (not
  // ready) and the refcount drops to zero, the on-disk file is unlinked
  // immediately because nobody will ever serve a half-written file —
  // a fresh acquire() will redo the encode.
  release: async (key: TranscodeCacheKey): Promise<void> => {
    const hashed = hashKey(key)
    const entry = entries.get(hashed)
    if (!entry) {
      return
    }
    entry.refCount = Math.max(0, entry.refCount - 1)
    entry.lastAccess = Date.now()
    if (!entry.isReady && entry.refCount === 0) {
      try {
        await rm(entry.tempPath, { force: true })
      }
      catch {
        // file may not have been created yet — fine.
      }
      entries.delete(hashed)
      return
    }
    if (entry.isReady) {
      await evictIfOverCap()
    }
  },

  // Removes an entry's on-disk file and bookkeeping unconditionally.
  // Intended for the encoder's failure path so a partial cache file
  // doesn't get served by a retry.
  invalidate: async (key: TranscodeCacheKey): Promise<void> => {
    const hashed = hashKey(key)
    const entry = entries.get(hashed)
    if (!entry) {
      return
    }
    entries.delete(hashed)
    try {
      await rm(entry.tempPath, { force: true })
    }
    catch {
      // already gone — fine.
    }
  },

  // Test helper: drop all in-memory bookkeeping. Does NOT remove
  // on-disk files (tests use memfs which resets per-test anyway).
  __resetForTests: (): void => {
    entries.clear()
    isCacheDirectoryEnsured = false
    maxTotalBytes = parseMaxBytes()
  },

  // Test helper: peek at the current entries. Returns a fresh array so
  // callers can't mutate the underlying Map.
  __snapshotForTests: (): CacheEntry[] => (
    Array.from(entries.values()).map((entry) => ({ ...entry }))
  ),

  // Best-effort cleanup of the on-disk cache directory. Wired into a
  // process.on('exit') / beforeExit listener by the route module so a
  // dev-mode Ctrl+C doesn't leave gigabytes of orphaned `.webm` shards.
  cleanupOnShutdown: (): void => {
    const directoryPath = cacheDirectoryPath()
    try {
      const stats = statSync(directoryPath)
      if (!stats.isDirectory()) {
        return
      }
    }
    catch {
      return
    }
    // Synchronous + best-effort — process is exiting, can't await.
    try {
      rmSync(directoryPath, { force: true, recursive: true })
    }
    catch {
      // nothing to do during shutdown.
    }
  },
}
