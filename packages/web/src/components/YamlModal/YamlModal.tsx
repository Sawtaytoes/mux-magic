import { useAtom, useAtomValue } from "jotai"
import { useState } from "react"
import { yamlModalOpenAtom } from "../../components/YamlModal/yamlModalAtom"
import { toYamlStr } from "../../jobs/yamlSerializer"
import { Modal } from "../../primitives/Modal/Modal"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"

export const YamlModal = () => {
  const [isOpen, setIsOpen] = useAtom(yamlModalOpenAtom)
  const steps = useAtomValue(stepsAtom)
  const paths = useAtomValue(pathsAtom)
  const commands = useAtomValue(commandsAtom)
  const [copyLabel, setCopyLabel] = useState("Copy")

  const close = () => setIsOpen(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      toYamlStr(steps, paths, commands),
    )
    setCopyLabel("Copied!")
    setTimeout(() => setCopyLabel("Copy"), 2000)
  }

  return (
    <Modal isOpen={isOpen} onClose={close} ariaLabel="YAML">
      <div
        id="yaml-modal"
        className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col"
        style={{
          width: "min(90vw,800px)",
          maxHeight: "85vh",
        }}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-700">
          <span className="text-xs font-medium text-slate-400">
            YAML
          </span>
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
        <pre
          id="yaml-out"
          className="flex-1 overflow-auto p-4 text-xs text-emerald-400 font-mono leading-relaxed whitespace-pre"
        >
          {toYamlStr(steps, paths, commands)}
        </pre>
      </div>
    </Modal>
  )
}
