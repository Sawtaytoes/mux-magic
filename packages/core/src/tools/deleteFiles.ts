import { rm } from "node:fs/promises"

import { isNetworkPath } from "./isNetworkPath.js"
import {
  PathSafetyError,
  validateReadablePath,
} from "./pathSafety.js"

export type DeleteMode = "trash" | "permanent"

export type DeleteResult = {
  path: string
  isOk: boolean
  // Reflects the strategy actually used for this path. Differs from the
  // batch-level `mode` when the global setting is `trash` but a specific
  // path is on a Windows network drive (no Recycle Bin available there)
  // and falls back to permanent. The UI surfaces this so the user knows
  // when "Move to Recycle Bin" silently became permanent.
  mode: DeleteMode
  error: string | null
}

// Resolves the global delete strategy from the single DELETE_MODE env var:
//
//   - "permanent" — hard delete via `fs.rm`. On the NAS the freedesktop
//     trash dir (`.Trash-0`) just accumulates with nothing to clean it up,
//     so this lets the operator skip trash entirely (filesystem snapshots
//     are the recovery story instead).
//   - "trash" (default, also the value for anything unset/unrecognized) —
//     move to the OS / freedesktop trash.
//
// One value, two states — trash and permanent are mutually exclusive, so a
// single mode reads cleaner than a pair of booleans.
export const getDeleteMode = (): DeleteMode =>
  process.env.DELETE_MODE?.trim().toLowerCase() ===
  "permanent"
    ? "permanent"
    : "trash"

// Returns the EFFECTIVE mode for a given path: starts from the global
// DELETE_MODE but downgrades to 'permanent' when the path is on a Windows
// network drive — the OS Recycle Bin can't service those, and the trash
// package's shell call would either silently permanent-delete or fail.
export const getEffectiveDeleteMode = (
  path: string,
): DeleteMode => {
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
// operator to flip DELETE_MODE globally.
export const deleteFiles = async (
  paths: string[],
): Promise<{ results: DeleteResult[] }> => {
  const baseMode = getDeleteMode()

  // Dynamically imported only when the global setting wants trash —
  // permanent-mode deployments don't pay the import cost. The package
  // is ESM-only so a top-level static import would force the whole
  // module to ESM-load even when unused.
  const trashFn =
    baseMode === "trash"
      ? (await import("trash")).default
      : null

  const results = await Promise.all(
    paths.map(async (path): Promise<DeleteResult> => {
      let validated: string
      try {
        validated = validateReadablePath(path)
      } catch (error) {
        const message =
          error instanceof PathSafetyError
            ? error.message
            : String(error)
        return {
          path,
          isOk: false,
          mode: baseMode,
          error: message,
        }
      }
      const effectiveMode =
        getEffectiveDeleteMode(validated)
      try {
        if (effectiveMode === "trash" && trashFn) {
          await trashFn([validated])
        } else {
          // Permanent delete: `recursive` so a selected directory (e.g.
          // an empty UNNAMED-FEATURES folder or a `.Trash-0` dir) is
          // removed too, and `force` so a missing path resolves quietly
          // rather than throwing ENOENT.
          await rm(validated, {
            recursive: true,
            force: true,
          })
        }
        return {
          path: validated,
          isOk: true,
          mode: effectiveMode,
          error: null,
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error)
        return {
          path: validated,
          isOk: false,
          mode: effectiveMode,
          error: message,
        }
      }
    }),
  )

  return { results }
}
