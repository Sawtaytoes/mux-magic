import {
  mkdir,
  readdir,
  readlink,
  symlink,
  unlink,
} from "node:fs/promises"
import { join } from "node:path"

import {
  aclSafeCopyFile,
  type CopyOptions,
} from "./aclSafeCopyFile.js"
import { hasErrorCode } from "./hasErrorCode.js"

/**
 * Same option bag as a single-file copy. `onProgress` fires once per
 * file inside the tree (the kernel tier emits one completion event
 * per file), not once for the folder.
 */
export type CopyFolderOptions = CopyOptions

const buildAbortError = (signal: AbortSignal) =>
  signal.reason instanceof Error
    ? signal.reason
    : new Error("aborted")

// `fs.cp` recreates a symlink verbatim rather than following it, and a
// recursive copy that silently dereferenced one would duplicate whole
// trees. `symlink` has no force flag, so an existing link is replaced
// only when the caller opted into overwriting.
const copySymbolicLink = async ({
  destination,
  isOverwriteAllowed,
  source,
}: {
  destination: string
  isOverwriteAllowed: boolean
  source: string
}) => {
  const linkTarget = await readlink(source)
  try {
    await symlink(linkTarget, destination)
  } catch (error) {
    if (
      !hasErrorCode(error, "EEXIST") ||
      !isOverwriteAllowed
    ) {
      throw error
    }
    await unlink(destination)
    await symlink(linkTarget, destination)
  }
}

/**
 * Recursively copies a directory tree, routing every regular file
 * through `aclSafeCopyFile`.
 *
 * This exists because `fs.cp(source, destination, { recursive: true })`
 * does not. `fs.cp` copies each file with libuv's `fs.copyFile`, whose
 * post-copy `fchmod` returns EPERM on a TrueNAS ZFS dataset configured
 * with `aclmode=restricted` — the same failure `aclSafeCopyFile` was
 * written to absorb. `fs.cp` has no hook to absorb it, so the whole
 * recursive copy aborts after writing nothing. Walking the tree here
 * and delegating each file keeps that EPERM handling on the recursive
 * path too. See `aclSafeCopyFile` for the tiering and the atomic
 * temp-then-rename contract each file still gets.
 *
 * Directories are created before their contents, so the
 * "parent must already exist" precondition of `aclSafeCopyFile` holds.
 * Entries are copied one at a time: a folder copy is usually many
 * large files, and unbounded concurrency buys nothing on spinning or
 * network storage while multiplying open file descriptors.
 *
 * `options.signal` is checked between entries, so an abort stops the
 * walk at the next file boundary in addition to interrupting the
 * in-flight streaming copy.
 */
export const aclSafeCopyFolder = async (
  source: string,
  destination: string,
  options?: CopyFolderOptions,
): Promise<void> => {
  const signal = options?.signal
  const isOverwriteAllowed =
    options?.isOverwriteAllowed === true

  await mkdir(destination, { recursive: true })

  const entries = await readdir(source, {
    withFileTypes: true,
  })

  await entries.reduce(async (previousEntry, entry) => {
    await previousEntry

    if (signal?.aborted === true) {
      throw buildAbortError(signal)
    }

    const entrySource = join(source, entry.name)
    const entryDestination = join(destination, entry.name)

    if (entry.isSymbolicLink()) {
      return copySymbolicLink({
        destination: entryDestination,
        isOverwriteAllowed,
        source: entrySource,
      })
    }
    if (entry.isDirectory()) {
      return aclSafeCopyFolder(
        entrySource,
        entryDestination,
        options,
      )
    }
    return aclSafeCopyFile(
      entrySource,
      entryDestination,
      options,
    )
  }, Promise.resolve())
}
