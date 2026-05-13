// Types owned by FileExplorerModal â€” the file-browser modal opened
// from PathField, PathVariableCard, and "Browse folders" buttons.
//
// FileEntry is defined server-side (shared API contract); the sort
// + state types are UI-only and live here.

import type { FileEntry } from "@mux-magic/server/api-types"

export type { FileEntry }

export type SortColumn =
  | "default"
  | "name"
  | "duration"
  | "size"
  | "mtime"

export type SortDirection = "asc" | "desc"

export type FileExplorerState = {
  path: string
  pickerOnSelect: ((selectedPath: string) => void) | null
}
