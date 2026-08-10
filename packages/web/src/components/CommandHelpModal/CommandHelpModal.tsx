import { Dialog } from "@charcuterie/ui"
import { useAtom, useAtomValue } from "jotai"
import {
  commandHelpCommandNameAtom,
  commandHelpModalOpenAtom,
} from "../../components/CommandHelpModal/commandHelpAtoms"
import { commandLabel } from "../../jobs/commandLabels"
import { commandsAtom } from "../../state/commandsAtom"
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
  const commandConfig = commandName
    ? commands[commandName]
    : undefined

  return (
    <Dialog
      heading={
        commandName
          ? `Help: ${commandLabel(commandName)}`
          : "Help"
      }
      isVisible={isVisible && Boolean(commandConfig)}
      onClose={close}
      size="lg"
    >
      {commandConfig && commandName && (
        <div className="space-y-4">
          {commandConfig.summary && (
            <p className="text-sm text-content-secondary leading-relaxed">
              {commandConfig.summary}
            </p>
          )}
          {commandConfig.note && (
            <p className="text-xs text-intent-warning-content bg-intent-warning-surface border border-intent-warning-border rounded px-2 py-1">
              {commandConfig.note}
            </p>
          )}
          {commandConfig.outputFolderName && (
            <p className="text-xs text-intent-warning-content">
              → outputs to{" "}
              <code className="text-intent-warning-content bg-surface-sunken px-1 rounded">
                {commandConfig.outputFolderName}/
              </code>{" "}
              subfolder
            </p>
          )}
          {commandConfig.fields.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-wide font-semibold text-content-muted">
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
            <p className="text-xs text-content-muted italic">
              This command has no configurable fields.
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}
