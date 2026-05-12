import { atom } from "jotai"

export type LogEntry = { key: string; line: string }

export const logsByJobIdAtom = atom<
  Map<string, LogEntry[]>
>(new Map())
