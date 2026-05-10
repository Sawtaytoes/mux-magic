import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useState } from "react"
import { pathsAtom } from "../state/pathsAtom"
import {
  stepCounterAtom,
  stepsAtom,
} from "../state/stepsAtom"
import { loadModalOpenAtom } from "../state/uiAtoms"
import type { Commands } from "../types"
import { loadYamlFromText } from "./loadYaml"

export const LoadModal = () => {
  const [isOpen, setIsOpen] = useAtom(loadModalOpenAtom)
  const setSteps = useSetAtom(stepsAtom)
  const setPaths = useSetAtom(pathsAtom)
  const setStepCounter = useSetAtom(stepCounterAtom)
  const currentPaths = useAtomValue(pathsAtom)
  const currentStepCounter = useAtomValue(stepCounterAtom)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setIsOpen(false)
    setError(null)
  }

  // Backdrop click: close only when the click landed directly on the backdrop,
  // not on content inside it (event.target check mirrors the legacy guard).
  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (event.target === event.currentTarget) close()
  }

  useEffect(() => {
    if (!isOpen) return

    const handlePaste = (event: ClipboardEvent) => {
      const text =
        event.clipboardData?.getData("text/plain") ?? ""
      if (!text.trim()) return
      // Prevent paste inserting into any focused input that was open when the
      // modal opened — the clipboard content is the only intended input here.
      event.preventDefault()
      setError(null)

      try {
        const commands = window.mediaTools
          .COMMANDS as Commands
        const result = loadYamlFromText(
          text,
          commands,
          currentPaths,
          currentStepCounter,
        )
        setSteps(result.steps)
        setPaths(result.paths)
        setStepCounter(result.stepCounter)
        // Side-effects owned by legacy JS during the transitional period.
        window.mediaTools.renderAll?.()
        window.mediaTools.updateUrl?.()
        window.mediaTools.kickReverseLookups?.()
        window.mediaTools.kickTmdbResolutions?.()
        setIsOpen(false)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error",
        )
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("paste", handlePaste)
    }
  }, [
    isOpen,
    currentPaths,
    currentStepCounter,
    setSteps,
    setPaths,
    setStepCounter,
    setIsOpen,
  ])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
        setError(null)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="none"
      onClick={handleBackdropClick}
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false)
      }}
      data-testid="load-modal-backdrop"
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col"
        style={{ width: "min(90vw,560px)" }}
        role="none"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-700">
          <span className="text-xs font-medium text-slate-400">
            Load YAML
          </span>
          <button
            type="button"
            onClick={close}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ✕ Close
          </button>
        </div>
        <div className="px-6 py-8 text-center space-y-3">
          <p className="text-sm text-slate-300">
            Paste your saved sequence YAML anywhere on the
            page.
          </p>
          <p className="text-xs text-slate-500">
            Press{" "}
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px]">
              Ctrl + V
            </kbd>{" "}
            /{" "}
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px]">
              ⌘ + V
            </kbd>{" "}
            to paste ·{" "}
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px]">
              Esc
            </kbd>{" "}
            to cancel
          </p>
          {error !== null && (
            <p
              role="alert"
              className="text-xs text-red-400"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
