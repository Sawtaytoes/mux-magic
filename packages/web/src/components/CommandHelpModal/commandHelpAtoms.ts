import { atom } from "jotai"

export const commandHelpModalOpenAtom = atom<boolean>(false)

export const commandHelpCommandNameAtom = atom<
  string | null
>(null)
