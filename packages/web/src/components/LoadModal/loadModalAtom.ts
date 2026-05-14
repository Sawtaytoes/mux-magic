import { atom } from "jotai"

export const loadModalOpenAtom = atom<boolean>(false)

// True while the Load button's auto-clipboard-paste attempt is in flight.
// PageHeader sets this synchronously alongside `loadModalOpenAtom = true` so
// LoadModal can mount its paste listener (gated on `loadModalOpenAtom`) while
// rendering the Modal primitive as `isOpen={false}` — auto-paste success closes
// the modal before it ever becomes visible (no flash), and failure clears this
// flag in `finally` so the modal becomes visible for manual Ctrl+V.
export const loadModalAutoPastingAtom = atom<boolean>(false)
