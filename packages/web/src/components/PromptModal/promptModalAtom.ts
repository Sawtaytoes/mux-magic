import { atom } from "jotai"
import type { PromptData } from "./types"

export const promptModalAtom = atom<PromptData | null>(null)
