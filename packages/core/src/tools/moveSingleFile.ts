import { rename, stat, unlink } from "node:fs/promises"
import {
  aclSafeCopyFile,
  type CopyOptions,
} from "@mux-magic/tools"

// A move is `fs.rename` — no temp file, no byte copy on the same
// volume. Extracted from moveFiles so every command that moves a file
// shares ONE implementation; see
// docs/decisions/2026-05-19-atomic-copy-and-filesystem-move.md
// ("Do not route a same-volume move through the copy path").

export const hasErrorCode = (
  error: unknown,
  code: string,
) =>
  error !== null &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: unknown }).code === code

export const buildExistsError = (
  destination: string,
): Error & { code: string } => {
  const error = new Error(
    `Refusing to overwrite existing destination: ${destination}`,
  ) as Error & { code: string }
  error.code = "EEXIST"
  return error
}

export const checkDestination = async (
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

// Same-volume rename short-circuit: metadata-only O(1) move. EXDEV
// (cross-volume) triggers the streaming-copy fallback, which retains
// per-byte progress and the AbortController wiring.
export const moveSingleFile = async ({
  copyOptions,
  destinationPath,
  isOverwriteAllowed,
  sourcePath,
}: {
  copyOptions: CopyOptions
  destinationPath: string
  isOverwriteAllowed: boolean
  sourcePath: string
}): Promise<"renamed" | "copied"> => {
  const hasExistingDestination = await checkDestination(
    destinationPath,
    isOverwriteAllowed,
  )
  if (hasExistingDestination) {
    // On Windows `rename` errors with EPERM against an existing
    // target; the EXDEV fallback's aclSafeCopyFile already handles
    // its own destination-exists case via the same temp+rename
    // primitive, so we only need to clear the path here for the
    // rename fast-path.
    await unlink(destinationPath).catch((error) => {
      if (hasErrorCode(error, "ENOENT")) return
      throw error
    })
  }
  try {
    await rename(sourcePath, destinationPath)
    return "renamed"
  } catch (error) {
    if (!hasErrorCode(error, "EXDEV")) throw error
    // Cross-volume: stream the bytes, then drop the source entry.
    // aclSafeCopyFile is already temp+rename + EEXIST-safe; pass
    // isOverwriteAllowed through so it doesn't re-trip on the same
    // destination check we just made.
    await aclSafeCopyFile(sourcePath, destinationPath, {
      ...copyOptions,
      isOverwriteAllowed: true,
    })
    await unlink(sourcePath)
    return "copied"
  }
}
