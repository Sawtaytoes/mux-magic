import { atom } from "jotai"

import type { TemplateListItem } from "./templatesApi"

// Saved-templates list as last fetched from /api/templates. Hydrated
// on mount of the SavedTemplatesPanel and re-fetched after every
// mutation (create / update / delete). Kept deliberately simple — no
// stale-while-revalidate, no optimistic updates — because the list is
// small and the API is local-only.

export const templatesAtom = atom<TemplateListItem[]>([])

// Id of the template currently mirrored into the live sequence atoms
// (stepsAtom / pathsAtom). null when the user is editing an unsaved
// sequence or a sequence loaded from ?seq=. Used by "Update from
// current" to know which row to PUT against.
export const selectedTemplateIdAtom = atom<string | null>(
  null,
)

// Last-fetch error surfaced in the sidebar. Cleared on successful
// re-fetch. Distinct atom (rather than co-located on templatesAtom)
// so a transient network blip doesn't blank the list.
export const templatesErrorAtom = atom<string | null>(null)

// Snapshot of the prior sequence captured before "Load template"
// replaces it. Drives the undo-toast that lets the user restore what
// they were editing if loading was a mistake. `null` means no undo
// is currently available.
export type SequenceSnapshot = {
  steps: unknown[]
  paths: unknown[]
  templateIdAtTimeOfLoad: string | null
}

export const templateLoadUndoAtom =
  atom<SequenceSnapshot | null>(null)
