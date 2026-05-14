import { atom } from "jotai"

// null = no override; server falls back to DEFAULT_THREAD_COUNT.
// A numeric string (e.g. "4") is serialized into the YAML variables block
// and read by the sequence runner to enforce per-job task admission.
export const threadCountAtom = atom<string | null>(null)
