import { useRef, useState } from "react"
import { PortalDropdown } from "../PortalDropdown/PortalDropdown"
import {
  LOW_CONFIDENCE_THRESHOLD,
  type ScoredCandidate,
} from "./smartMatchScoring"

// Styled "Rename to" picker for the SmartMatchModal. Replaces the
// native <select> with a PortalDropdown-based trigger so each option
// can render as two rows (candidate name on top + a meta row with
// timecode chip + confidence chip below) instead of cramming
// everything into one HTML option label. Matches the rest of the
// builder's typeahead-style pickers (EnumPicker / LanguageCodeField /
// CommandPicker) — see worker 87211dcf for the shared PortalDropdown
// flip-up behavior.
type Props = {
  candidates: ScoredCandidate[]
  selectedName: string
  onSelect: (name: string) => void
  isDisabled: boolean
  ariaLabel: string
}

const formatConfidence = (confidence: number): string =>
  `${Math.round(confidence * 100)}%`

const confidenceClass = (confidence: number): string =>
  confidence >= LOW_CONFIDENCE_THRESHOLD
    ? "bg-emerald-700 text-emerald-100"
    : "bg-amber-700 text-amber-100"

const findScored = (
  candidates: ScoredCandidate[],
  name: string,
): ScoredCandidate | null =>
  candidates.find(
    (scored) => scored.candidate.name === name,
  ) ?? null

export const RenameTargetPicker = ({
  candidates,
  selectedName,
  onSelect,
  isDisabled,
  ariaLabel,
}: Props) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const selected = findScored(candidates, selectedName)

  const close = () => setIsOpen(false)

  const toggle = () => {
    if (isDisabled) return
    setIsOpen((isPrev) => !isPrev)
  }

  // setTimeout dance is the same trick as LanguageCodeField — without
  // it, the mousedown inside the dropdown loses the race against the
  // trigger's onBlur and the dropdown closes before the click lands.
  const handleBlur = () => {
    setTimeout(close, 150)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={isDisabled}
        onClick={toggle}
        onBlur={handleBlur}
        className="w-full text-left text-xs bg-slate-950 text-slate-100 border border-slate-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <span className="flex-1 min-w-0 flex flex-col">
          {selected?.candidate.parentName && (
            <span
              data-rename-target-parent-label
              className="text-[9px] text-slate-500 font-mono uppercase tracking-wider truncate"
            >
              under {selected.candidate.parentName}
            </span>
          )}
          <span
            data-rename-target-name
            className="font-mono truncate"
          >
            {selected?.candidate.name ?? selectedName ?? (
              <span className="text-slate-500 italic">
                Pick a candidate…
              </span>
            )}
          </span>
          {selected && (
            <span className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono">
              {selected.candidate.timecode && (
                <span
                  data-rename-target-timecode
                  className="bg-slate-800 text-slate-300 px-1.5 py-0 rounded border border-slate-700"
                >
                  {selected.candidate.timecode}
                </span>
              )}
              <span
                data-rename-target-confidence
                className={`px-1.5 py-0 rounded ${confidenceClass(selected.confidence)}`}
              >
                {formatConfidence(selected.confidence)}
              </span>
            </span>
          )}
        </span>
        <span
          aria-hidden
          className="text-slate-400 text-[10px] shrink-0"
        >
          ▾
        </span>
      </button>
      <PortalDropdown
        anchorRef={triggerRef}
        isOpen={isOpen}
        items={candidates.map((scored) => {
          const { name, timecode, parentName } =
            scored.candidate
          const isChild = Boolean(parentName)
          return {
            key: name,
            onSelect: () => {
              onSelect(name)
              close()
            },
            content: (
              <div
                data-rename-target-option
                data-rename-target-option-name={name}
                data-rename-target-option-parent={
                  parentName
                }
                className="flex flex-col gap-0.5"
              >
                {parentName && (
                  <span
                    data-rename-target-option-parent-label
                    className="text-[9px] text-slate-500 font-mono uppercase tracking-wider"
                  >
                    under {parentName}
                  </span>
                )}
                <span
                  className={`text-xs font-mono text-slate-100 wrap-break-word ${isChild ? "pl-3 border-l border-slate-700" : ""}`}
                >
                  {isChild && (
                    <span
                      aria-hidden
                      className="text-slate-500 mr-1"
                    >
                      ↳
                    </span>
                  )}
                  {name}
                </span>
                <span
                  className={`flex items-center gap-1.5 text-[10px] font-mono ${isChild ? "pl-3" : ""}`}
                >
                  {timecode && (
                    <span className="bg-slate-900 text-slate-300 px-1.5 py-0 rounded border border-slate-700">
                      {timecode}
                    </span>
                  )}
                  <span
                    className={`px-1.5 py-0 rounded ${confidenceClass(scored.confidence)}`}
                  >
                    {formatConfidence(scored.confidence)}
                  </span>
                </span>
              </div>
            ),
          }
        })}
      />
    </>
  )
}
