import { atom } from "jotai"
import type { Commands } from "../commands/types"

export const commandsAtom = atom<Commands>({})
