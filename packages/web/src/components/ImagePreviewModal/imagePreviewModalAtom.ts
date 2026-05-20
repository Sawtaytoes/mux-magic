import { atom } from "jotai"

export type ImagePreviewState = {
  path: string
}

export const imagePreviewModalAtom =
  atom<ImagePreviewState | null>(null)
