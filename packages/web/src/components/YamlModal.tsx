import { useAtom, useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { pathsAtom } from "../state/pathsAtom"
import { stepsAtom } from "../state/stepsAtom"
import { yamlModalOpenAtom } from "../state/uiAtoms"
import { toYamlStr } from "./yamlSerializer"

export const YamlModal = () => {
  const [isOpen, setIsOpen] = useAtom(yamlModalOpenAtom)
  const steps = useAtomValue(stepsAtom)
  const paths = useAtomValue(pathsAtom)
  const [copyLabel, setCopyLabel] = useState("Copy")

  const close = () => setIsOpen(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(toYamlStr(steps, paths))
    setCopyLabel("Copied!")
    setTimeout(() => setCopyLabel("Copy"), 2000)
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close()
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      id="yaml-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={handleBackdropClick}
      data-testid="yaml-modal-backdrop"
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col"
        style={{ width: "min(90vw,800px)", maxHeight: "85vh" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-700">
          <span className="text-xs font-medium text-slate-400">YAML</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {copyLabel}
            </button>
            <button
              type="button"
              onClick={close}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              ✕ Close
            </button>
          </div>
        </div>
        <pre id="yaml-out" className="flex-1 overflow-auto p-4 text-xs text-emerald-400 font-mono leading-relaxed whitespace-pre">
          {toYamlStr(steps, paths)}
        </pre>
      </div>
    </div>
  )
}
