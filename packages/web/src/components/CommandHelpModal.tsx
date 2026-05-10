import { useAtom, useAtomValue } from "jotai"
import { useEffect } from "react"

import {
  commandHelpCommandNameAtom,
  commandHelpModalOpenAtom,
} from "../state/uiAtoms"
import type { CommandDefinition } from "../types"
import { CommandFieldEntry } from "./CommandFieldEntry"

export const CommandHelpModal = () => {
  const [isOpen, setIsOpen] = useAtom(
    commandHelpModalOpenAtom,
  )
  const commandName = useAtomValue(
    commandHelpCommandNameAtom,
  )

  const close = () => setIsOpen(false)

  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (event.target === event.currentTarget) {
      close()
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () =>
      document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, setIsOpen])

  if (!isOpen || !commandName) {
    return null
  }

  const commands = (window.mediaTools?.COMMANDS ??
    {}) as Record<string, CommandDefinition>
  const commandConfig = commands[commandName]

  if (!commandConfig) {
    return null
  }

  const summary =
    (typeof window.getCommandSummary === "function"
      ? window.getCommandSummary({ commandName })
      : "") ||
    commandConfig.summary ||
    ""

  const commandLabelText =
    typeof window.commandLabel === "function"
      ? window.commandLabel(commandName)
      : commandName

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="none"
      onClick={handleBackdropClick}
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false)
      }}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col"
        style={{
          width: "min(90vw,700px)",
          maxHeight: "85vh",
        }}
        role="none"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-700">
          <span className="text-xs font-medium text-slate-400">
            Help: {commandLabelText}
          </span>
          <button
            type="button"
            onClick={close}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ✕ Close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {summary && (
            <p className="text-sm text-slate-300 leading-relaxed">
              {summary}
            </p>
          )}
          {commandConfig.note && (
            <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded px-2 py-1">
              {commandConfig.note}
            </p>
          )}
          {commandConfig.outputFolderName && (
            <p className="text-xs text-amber-500/80">
              → outputs to{" "}
              <code className="text-amber-400 bg-slate-950 px-1 rounded">
                {commandConfig.outputFolderName}/
              </code>{" "}
              subfolder
            </p>
          )}
          {commandConfig.fields.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                Fields
              </h3>
              {commandConfig.fields.map((field) => (
                <CommandFieldEntry
                  key={field.name}
                  commandName={commandName}
                  field={field}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              This command has no configurable fields.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
