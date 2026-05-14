// ─── Dry-Run query-string helper + atoms ──────────────────────────────────────
//
// The server detects "fake / dry-run" mode via a `?fake=...` query param
// on the request URL (see packages/server/src/fake-data/index.ts:
// `isFakeRequest`, `getFakeScenario`). Both the atoms and every fetch
// URL are driven by this single param:
//
//   ?fake=success  → isDryRun true,  isFailureMode false
//   ?fake=failure  → isDryRun true,  isFailureMode true
//   (absent)       → isDryRun false, isFailureMode false
//
// State is per-tab: each browser tab owns its URL, so one tab can be
// in dry-run mode while another is in live mode.

import { atom } from "jotai"
import { apiBase } from "../apiBase"

type FakeParam = "success" | "failure" | null

const readFakeFromUrl = (): FakeParam => {
  const params = new URLSearchParams(window.location.search)
  const value = params.get("fake")
  if (value === "success" || value === "failure")
    return value
  return null
}

const writeFakeToUrl = (value: FakeParam): void => {
  const params = new URLSearchParams(window.location.search)
  if (value === null) {
    params.delete("fake")
  } else {
    params.set("fake", value)
  }
  const search = params.toString()
  history.replaceState(
    null,
    "",
    search
      ? `${window.location.pathname}?${search}`
      : window.location.pathname,
  )
}

// Bumped on every URL write or popstate so derived atoms re-read the URL.
const urlVersionAtom = atom(0)
urlVersionAtom.onMount = (set) => {
  const handlePopState = () => {
    set((version) => version + 1)
  }
  window.addEventListener("popstate", handlePopState)
  return () => {
    window.removeEventListener("popstate", handlePopState)
  }
}

// Derives the ?fake param value from the URL; depends on urlVersionAtom
// so subscribers are notified when the URL changes.
const fakeParamAtom = atom(
  (get): FakeParam => {
    get(urlVersionAtom)
    return readFakeFromUrl()
  },
  (_get, set, newValue: FakeParam): void => {
    writeFakeToUrl(newValue)
    set(urlVersionAtom, (version) => version + 1)
  },
)

export const dryRunAtom = atom(
  (get) => get(fakeParamAtom) !== null,
  (get, set, isNextDryRun: boolean): void => {
    const isFailureMode = get(fakeParamAtom) === "failure"
    set(
      fakeParamAtom,
      isNextDryRun
        ? isFailureMode
          ? "failure"
          : "success"
        : null,
    )
  },
)

export const failureModeAtom = atom(
  (get) => get(fakeParamAtom) === "failure",
  (get, set, isNextFailureMode: boolean): void => {
    const isCurrentlyDryRun = get(fakeParamAtom) !== null
    if (!isCurrentlyDryRun) return
    set(
      fakeParamAtom,
      isNextFailureMode ? "failure" : "success",
    )
  },
)

export type DryRunInputs = {
  isDryRun: boolean
  isFailureMode: boolean
}

export const buildRunFetchUrl = (
  path: string,
  inputs: DryRunInputs,
): string => {
  const baseUrl = `${apiBase}${path}`
  if (!inputs.isDryRun) return baseUrl
  // ?fake=success / ?fake=failure parallels the server scenario names
  // (see packages/server/src/fake-data/scenarios/*). Avoids the older
  // "?fake=1" alias which leaves readers guessing what 1 means.
  const fakeValue = inputs.isFailureMode
    ? "failure"
    : "success"
  const separator = baseUrl.includes("?") ? "&" : "?"
  return `${baseUrl}${separator}fake=${fakeValue}`
}
