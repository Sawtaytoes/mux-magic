import { useAtom, useAtomValue } from "jotai"
import { useEffect } from "react"
import {
  commandHelpCommandNameAtom,
  commandHelpModalOpenAtom,
} from "../state/uiAtoms"
import type {
  CommandDefinition,
  CommandField,
} from "../types"

interface FieldEntryProps {
  commandName: string
  field: CommandField
}

const FieldEntry = ({
  commandName,
  field,
}: FieldEntryProps) => {
  const description =
    typeof window.getCommandFieldDescription === "function"
      ? window.getCommandFieldDescription({
          commandName,
          fieldName: field.name,
        })
      : ""

  return (
    <div className="border-b border-slate-800 pb-3 last:border-b-0">
      <div className="flex items-baseline flex-wrap gap-2 mb-1">
        <span className="text-sm font-semibold text-slate-100">
          {field.label ?? field.name}
        </span>
        <code className="text-[11px] text-slate-500 font-mono">
          {field.name}
        </code>
        <span className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">
          {field.type}
        </span>
        {field.required && (
          <span className="text-[10px] uppercase tracking-wide font-semibold text-red-300 bg-red-950/60 border border-red-700/50 rounded px-1.5 py-0.5">
            required
          </span>
        )}
      </div>
      {description ? (
        <p className="text-xs text-slate-300 leading-relaxed">
          {description}
        </p>
      ) : (
        <p className="text-xs text-slate-500 italic">
          No description yet — add one in{" "}
          <code className="text-slate-400 bg-slate-950 px-1 rounded">
            src/api/schemas.ts
          </code>
          .
        </p>
      )}
    </div>
  )
}

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
    // biome-ignore lint/a11y/noStaticElementInteractions: suppressed during react-migration
    // biome-ignore lint/a11y/useKeyWithClickEvents: suppressed during react-migration
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={handleBackdropClick}
    >
      {/** biome-ignore lint/a11y/noStaticElementInteractions: suppressed during react-migration */}
      {/** biome-ignore lint/a11y/useKeyWithClickEvents: suppressed during react-migration */}
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col"
        style={{
          width: "min(90vw,700px)",
          maxHeight: "85vh",
        }}
        onClick={(event) => event.stopPropagation()}
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
                <FieldEntry
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
