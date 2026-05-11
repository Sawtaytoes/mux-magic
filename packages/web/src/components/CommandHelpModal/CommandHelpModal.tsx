import { useAtom, useAtomValue } from "jotai"

import { commandLabel } from "../../jobs/commandLabels"
import { commandsAtom } from "../../state/commandsAtom"
import {
  commandHelpCommandNameAtom,
  commandHelpModalOpenAtom,
} from "../../state/uiAtoms"
import { Modal } from "../../primitives/Modal/Modal"
import { CommandFieldEntry } from "../CommandFieldEntry/CommandFieldEntry"

export const CommandHelpModal = () => {
  const [isOpen, setIsOpen] = useAtom(
    commandHelpModalOpenAtom,
  )
  const commandName = useAtomValue(
    commandHelpCommandNameAtom,
  )
  const commands = useAtomValue(commandsAtom)

  const close = () => setIsOpen(false)

  const isVisible = isOpen && Boolean(commandName)
  const commandConfig =
    commandName ? commands[commandName] : undefined

  return (
    <Modal
      isOpen={isVisible && Boolean(commandConfig)}
      onClose={close}
      ariaLabel={
        commandConfig
          ? `Help: ${commandLabel(commandName ?? "")}`
          : "Help"
      }
    >
      {commandConfig && commandName && (
        <div
          className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col"
          style={{
            width: "min(90vw,700px)",
            maxHeight: "85vh",
          }}
        >
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-700">
            <span className="text-xs font-medium text-slate-400">
              Help: {commandLabel(commandName)}
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
            {commandConfig.summary && (
              <p className="text-sm text-slate-300 leading-relaxed">
                {commandConfig.summary}
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
      )}
    </Modal>
  )
}
