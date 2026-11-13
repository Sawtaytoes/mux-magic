import { stat, unlink } from "node:fs/promises"
import {
  aclSafeCopyFile,
  type CopyOptions,
  renameOntoDestination,
} from "@mux-magic/tools"

import { getPlatform } from "./currentEnvironment.js"

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
  try {
    await renameOntoDestination({
      destinationPath,
      hasExistingDestination,
      platform: getPlatform(),
      sourcePath,
    })
    return "renamed"
  } catch (error) {
    if (!hasErrorCode(error, "EXDEV")) throw error
    // Cross-volume: stream the bytes, then drop the source entry.
    // aclSafeCopyFile copies to a temp file and renames it into place,
    // so an existing destination survives until the copy is complete.
    // isOverwriteAllowed passes through so it doesn't re-trip on the
    // same destination check we just made.
    await aclSafeCopyFile(sourcePath, destinationPath, {
      ...copyOptions,
      isOverwriteAllowed: true,
    })
    await unlink(sourcePath)
    return "copied"
  }
}
