import { useAtom } from "jotai"
import { useEffect, useRef } from "react"

import { lookupModalAtom } from "../../state/uiAtoms"
import type { LookupState, LookupType } from "../../types"
import { LookupReleaseStage } from "../LookupReleaseStage/LookupReleaseStage"
import { LookupSearchStage } from "../LookupSearchStage/LookupSearchStage"
import { LookupVariantStage } from "../LookupVariantStage/LookupVariantStage"

const LOOKUP_TITLES: Record<LookupType, string> = {
  mal: "Look up MAL ID",
  anidb: "Look up AniDB ID",
  tvdb: "Look up TVDB ID",
  tmdb: "Look up TMDB ID",
  dvdcompare: "Look up DVDCompare Film ID",
}

// ─── LookupModal ──────────────────────────────────────────────────────────────

export const LookupModal = () => {
  const [state, setState] = useAtom(lookupModalAtom)
  const stateRef = useRef(state)
  stateRef.current = state

  const update = (patch: Partial<LookupState>) => {
    setState((prev) =>
      prev ? { ...prev, ...patch } : prev,
    )
  }

  const close = () => setState(null)

  // Keyboard: Esc closes; 1-9 select the active option in the current stage.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current
      if (!current) return
      if (event.key === "Escape") {
        setState(null)
        return
      }
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return
      const digit = parseInt(event.key, 10)
      if (Number.isNaN(digit)) return
      event.preventDefault()
      const index = digit - 1
      // Dispatch a click on the nth visible option button inside the modal.
      const modal = document.getElementById("lookup-modal")
      if (!modal) return
      const buttons = Array.from(
        modal.querySelectorAll<HTMLButtonElement>("button"),
      ).filter(
        (btn) => btn.dataset.optionIndex !== undefined,
      )
      buttons[index]?.click()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () =>
      document.removeEventListener("keydown", handleKeyDown)
  }, [setState])

  if (!state) return null

  const title = LOOKUP_TITLES[state.lookupType] ?? "Lookup"
  const canGoBack =
    state.stage === "variant" || state.stage === "release"

  const goBack = () => {
    if (state.stage === "release") {
      update({ stage: "variant" })
    } else if (state.stage === "variant") {
      update({ stage: "search", selectedGroup: null })
    }
  }

  return (
    <div
      id="lookup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="none"
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") close()
      }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[85dvh]">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 shrink-0">
          {canGoBack && (
            <button
              type="button"
              id="lookup-back-btn"
              onClick={goBack}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded border border-slate-700 hover:border-slate-500 mr-1"
            >
              ← Back
            </button>
          )}
          <h2
            id="lookup-title"
            className="text-sm font-semibold text-slate-100 flex-1"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            className="text-slate-400 hover:text-white text-base leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          id="lookup-body"
          className="flex-1 overflow-y-auto p-4 min-h-0"
        >
          {state.stage === "search" && (
            <LookupSearchStage
              state={state}
              onUpdate={update}
              onClose={close}
            />
          )}
          {state.stage === "variant" && (
            <LookupVariantStage
              state={state}
              onUpdate={update}
              onClose={close}
            />
          )}
          {state.stage === "release" && (
            <LookupReleaseStage
              state={state}
              onClose={close}
            />
          )}
        </div>
      </div>
    </div>
  )
}
