import { unlink } from "node:fs/promises"

import { isNetworkPath } from "./isNetworkPath.js"
import { PathSafetyError, validateReadablePath } from "./pathSafety.js"

export type DeleteMode = "trash" | "permanent"

export type DeleteResult = {
  path: string
  ok: boolean
  // Reflects the strategy actually used for this path. Differs from the
  // batch-level `mode` when the global setting is `trash` but a specific
  // path is on a Windows network drive (no Recycle Bin available there)
  // and falls back to permanent. The UI surfaces this so the user knows
  // when "Move to Recycle Bin" silently became permanent.
  mode: DeleteMode
  error: string | null
}

// Reads the DELETE_TO_TRASH env var. Default 'true'; pass 'false' / '0' /
// 'no' to opt out (e.g. Docker-on-remote-ZFS where the OS trash isn't
// useful and the user has filesystem snapshots as the recovery story).
export const getDeleteMode = (): DeleteMode => {
  const raw = process.env.DELETE_TO_TRASH
  if (raw === undefined) return "trash"
  const normalized = raw.trim().toLowerCase()
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return "permanent"
  }
  return "trash"
}

// Returns the EFFECTIVE mode for a given path: starts from the global
// DELETE_TO_TRASH but downgrades to 'permanent' when the path is on a
// Windows network drive — the OS Recycle Bin can't service those, and
// the trash package's shell call would either silently permanent-delete
// or fail.
export const getEffectiveDeleteMode = (path: string): DeleteMode => {
  const baseMode = getDeleteMode()
  if (baseMode === "permanent") return "permanent"
  if (isNetworkPath(path)) return "permanent"
  return "trash"
}

// Per-path delete with the configured strategy. Each path is validated
// for absolute-path / no-traversal first; failures don't abort the
// batch — the API surfaces them per-path so the UI can show "3
// succeeded, 1 failed" without losing the successful 3. The strategy
// is computed per-path via getEffectiveDeleteMode so a network-mapped
// folder can still be deleted (just permanently) without forcing the
// operator to flip DELETE_TO_TRASH globally.
export const deleteFiles = async (
  paths: string[],
): Promise<{ results: DeleteResult[] }> => {
  const baseMode = getDeleteMode()

  // Dynamically imported only when the global setting wants trash —
  // permanent-mode deployments don't pay the import cost. The package
  // is ESM-only so a top-level static import would force the whole
  // module to ESM-load even when unused.
  const trashFn = (
    baseMode === "trash"
      ? (await import("trash")).default
      : null
  )

  const results = await Promise.all(
    paths.map(async (path): Promise<DeleteResult> => {
      let validated: string
      try {
        validated = validateReadablePath(path)
      }
      catch (error) {
        const message = error instanceof PathSafetyError
          ? error.message
          : String(error)
        return { path, ok: false, mode: baseMode, error: message }
      }
      const effectiveMode = getEffectiveDeleteMode(validated)
      try {
        if (effectiveMode === "trash" && trashFn) {
          await trashFn([validated])
        }
        else {
          await unlink(validated)
        }
        return { path: validated, ok: true, mode: effectiveMode, error: null }
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { path: validated, ok: false, mode: effectiveMode, error: message }
      }
    }),
  )

  return { results }
}
