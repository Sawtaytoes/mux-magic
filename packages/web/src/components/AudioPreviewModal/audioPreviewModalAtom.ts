import { atom } from "jotai"

export type AudioPreviewState = {
  path: string
}

export const audioPreviewModalAtom =
  atom<AudioPreviewState | null>(null)
