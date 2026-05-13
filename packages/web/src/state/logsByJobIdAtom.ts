import { atom } from "jotai"

// eslint-disable-next-line no-restricted-syntax -- Jotai atom helper type; not an API shape
export type LogEntry = { key: string; line: string }

export const logsByJobIdAtom = atom<
  Map<string, LogEntry[]>
>(new Map())
