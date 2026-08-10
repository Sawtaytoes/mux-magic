import { Button, Dialog } from "@charcuterie/ui"
import { useAtom, useAtomValue } from "jotai"
import { useState } from "react"
import { yamlModalOpenAtom } from "../../components/YamlModal/yamlModalAtom"
import { toYamlStr } from "../../jobs/yamlCodec"
import { commandsAtom } from "../../state/commandsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import { variablesAtom } from "../../state/variablesAtom"

export const YamlModal = () => {
  const [isOpen, setIsOpen] = useAtom(yamlModalOpenAtom)
  const steps = useAtomValue(stepsAtom)
  // Read variablesAtom (all types) so the emitted YAML includes non-path
  // variables like dvdCompareId and threadCount. Reading pathsAtom would
  // silently drop them.
  const paths = useAtomValue(variablesAtom)
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
    <Dialog
      heading="YAML"
      isVisible={isOpen}
      onClose={close}
      size="xl"
      footer={
        <Button
          intent="neutral"
          appearance="soft"
          size="sm"
          onClick={handleCopy}
        >
          {copyLabel}
        </Button>
      }
    >
      <div id="yaml-modal">
        <pre
          id="yaml-out"
          className="overflow-auto text-xs text-intent-success-content font-mono leading-relaxed whitespace-pre"
        >
          {toYamlStr(steps, paths, commands)}
        </pre>
      </div>
    </Dialog>
  )
}
