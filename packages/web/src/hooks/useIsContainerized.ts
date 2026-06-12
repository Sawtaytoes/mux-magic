import { atom, useAtomValue } from "jotai"
import { apiBase } from "../apiBase"

// Single source of truth for whether the server is running in a
// container. Probed once per Jotai store via `onMount` — so any number
// of consumers (PromptModal, FileVideoPlayer, …) share one /version
// fetch instead of each firing their own on mount.
//
// Defaults to `false` so the UI never accidentally hides an
// Open-in-Local-Player button just because the probe is in flight: the
// pessimistic answer (host can launch a player) is the safe one — the
// button itself errors gracefully if the host can't actually launch.
const isContainerizedAtom = atom(false)
isContainerizedAtom.onMount = (set) => {
  fetch(`${apiBase}/version`, { cache: "no-store" })
    .then((resp) => resp.json())
    .then((data: { isContainerized?: boolean }) => {
      set(data.isContainerized === true)
    })
    .catch(() => {})
}

export const useIsContainerized = () =>
  useAtomValue(isContainerizedAtom)
