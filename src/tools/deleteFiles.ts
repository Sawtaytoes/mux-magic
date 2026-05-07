import { unlink } from "node:fs/promises"

import {
  getAllowedDeleteRoots,
  PathSafetyError,
  validateDeletablePath,
} from "./pathSafety.js"

export type DeleteMode = "trash" | "permanent"

export type DeleteResult = {
  path: string
  ok: boolean
  error: string | null
}

// Reads the DELETE_TO_TRASH env var with a safe default. Pass `false` /
// `0` / `no` to opt OUT of the OS Recycle Bin (e.g. when the server runs
// inside a Docker container against a remote ZFS share and the trash
// folder would land in a useless spot inside the container).
export const getDeleteMode = (): DeleteMode => {
  const raw = process.env.DELETE_TO_TRASH
  if (raw === undefined) return "trash"
  const normalized = raw.trim().toLowerCase()
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return "permanent"
  }
  return "trash"
}

// Per-path delete with the configured strategy. Each path is validated
// against ALLOWED_DELETE_ROOTS first; failures don't abort the batch —
// the API surfaces them per-path so the UI can show "3 succeeded, 1
// failed (out of allowed roots)" without losing the successful 3.
export const deleteFiles = async (
  paths: string[],
): Promise<{ mode: DeleteMode, results: DeleteResult[] }> => {
  const mode = getDeleteMode()
  const allowedRoots = getAllowedDeleteRoots()

  // trash is dynamically imported because it's an ESM-only package and
  // tree-shaking on cold start is faster when the user hasn't enabled
  // trash mode (DELETE_TO_TRASH=false skips loading it entirely).
  const trashFn = (
    mode === "trash"
      ? (await import("trash")).default
      : null
  )

  const results = await Promise.all(
    paths.map(async (path): Promise<DeleteResult> => {
      let validated: string
      try {
        validated = validateDeletablePath(path, allowedRoots)
      }
      catch (error) {
        if (error instanceof PathSafetyError) {
          return { path, ok: false, error: error.message }
        }
        return { path, ok: false, error: String(error) }
      }
      try {
        if (trashFn) {
          await trashFn([validated])
        }
        else {
          await unlink(validated)
        }
        return { path: validated, ok: true, error: null }
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { path: validated, ok: false, error: message }
      }
    }),
  )

  return { mode, results }
}
