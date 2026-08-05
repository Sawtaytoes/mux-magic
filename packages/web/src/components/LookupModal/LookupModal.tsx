import { Button, IconButton } from "@charcuterie/ui"
import { useAtom } from "jotai"
import { useEffect, useRef } from "react"
import { lookupModalAtom } from "../../components/LookupModal/lookupModalAtom"
import type {
  LookupState,
  LookupType,
} from "../../components/LookupModal/types"
import { Modal } from "../../primitives/Modal/Modal"
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

  // Keyboard: 1-9 select the active option in the current stage. Esc is handled by Modal primitive.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current
      if (!current) return
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return
      const digit = parseInt(event.key, 10)
      if (Number.isNaN(digit)) return
      event.preventDefault()
      const index = digit - 1
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
  }, [])

  const title =
    LOOKUP_TITLES[state?.lookupType ?? "mal"] ?? "Lookup"
  const isGoBackPossible =
    state?.stage === "variant" || state?.stage === "release"

  const goBack = () => {
    if (state?.stage === "release") {
      update({ stage: "variant" })
    } else if (state?.stage === "variant") {
      update({ stage: "search", selectedGroup: null })
    }
  }

  return (
    <Modal
      isOpen={Boolean(state)}
      onClose={close}
      ariaLabel={title}
    >
      {state && (
        <div
          id="lookup-modal"
          className="bg-surface-raised border border-border-default rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[85dvh]"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default shrink-0">
            {isGoBackPossible && (
              <Button
                id="lookup-back-btn"
                intent="neutral"
                appearance="outline"
                size="sm"
                onClick={goBack}
                className="mr-1"
              >
                ← Back
              </Button>
            )}
            <h2
              id="lookup-title"
              className="text-sm font-semibold text-content-primary flex-1"
            >
              {title}
            </h2>
            <IconButton
              label="Close"
              title="Close"
              intent="neutral"
              appearance="ghost"
              size="sm"
              onClick={close}
            >
              ✕
            </IconButton>
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
      )}
    </Modal>
  )
}
