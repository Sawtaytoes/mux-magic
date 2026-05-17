import { atom } from "jotai"

export type VideoPreviewState = {
  path: string
}

export const videoPreviewModalAtom =
  atom<VideoPreviewState | null>(null)
