// Pure helpers for the path autocomplete, relocated from the old
// atom-driven PathPicker singleton so `usePathAutocomplete` (and its test)
// can own them without the component. The directory-listing fetch, the
// directory-only prefix match, and the drill-down path builder.

import type { ListDirectoryEntriesResponse } from "@mux-magic/api/api-types"
import { apiBase } from "../../apiBase"
import type { DirEntry } from "./types"

// Absolute-ish enough to be worth querying the server: a leading
// separator, or a Windows drive root (`C:\`). Non-matching input keeps the
// popup shut, exactly as the old PathField/PathValueInput onChange guard.
export const isAbsolutePathLike = (
  rawValue: string,
): boolean => /^([/\\]|[A-Za-z]:[/\\])/.test(rawValue)

export const fetchDirEntries = async (
  parentPath: string,
): Promise<ListDirectoryEntriesResponse> => {
  const response = await fetch(
    `${apiBase}/queries/listDirectoryEntries`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: parentPath }),
    },
  )

  return response.json() as Promise<ListDirectoryEntriesResponse>
}

// Directory-only, prefix match on the trailing segment, alphabetical.
export const computeMatches = (
  entries: DirEntry[] | null,
  query: string,
): DirEntry[] => {
  if (!entries) {
    return []
  }

  const queryLower = query.toLowerCase()

  return entries
    .filter((entry) => entry.isDirectory)
    .filter(
      (entry) =>
        !queryLower ||
        entry.name.toLowerCase().startsWith(queryLower),
    )
    .sort((entryA, entryB) =>
      entryA.name.localeCompare(entryB.name),
    )
}

// Appends the picked folder to its parent with a trailing separator, so the
// next fetch re-roots into it (drill-down).
export const computeNewValue = (
  name: string,
  parentPath: string,
  separator: string,
): string => {
  const base =
    parentPath.endsWith("/") || parentPath.endsWith("\\")
      ? parentPath.slice(0, -1)
      : parentPath

  return `${base}${separator}${name}${separator}`
}
