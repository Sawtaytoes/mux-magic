import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { pathsAtom } from "../state/pathsAtom"
import { stepsAtom } from "../state/stepsAtom"
import { toYamlStr } from "./yamlSerializer"

interface YamlModalProps {
  isOpen: boolean
  onClose: () => void
}

export const YamlModal = ({ isOpen, onClose }: YamlModalProps) => {
  const [steps] = useAtom(stepsAtom)
  const [paths] = useAtom(pathsAtom)
  const [yamlContent, setYamlContent] = useState("")
  const [copyLabel, setCopyLabel] = useState("Copy")

  useEffect(() => {
    if (isOpen) {
      setYamlContent(toYamlStr(steps, paths))
    }
  }, [isOpen, steps, paths])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(yamlContent)
    setCopyLabel("Copied!")
    setTimeout(() => setCopyLabel("Copy"), 2000)
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={handleBackdropClick}
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
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              ✕ Close
            </button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto p-4 text-xs text-emerald-400 font-mono leading-relaxed whitespace-pre">
          {yamlContent}
        </pre>
      </div>
    </div>
  )
}
