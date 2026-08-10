import { Dialog } from "@charcuterie/ui"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useState } from "react"
import {
  loadModalAutoPastingAtom,
  loadModalOpenAtom,
} from "../../components/LoadModal/loadModalAtom"
import { loadYamlFromText } from "../../jobs/yamlCodec"
import { commandsAtom } from "../../state/commandsAtom"
import { pathsAtom } from "../../state/pathsAtom"
import { stepsAtom } from "../../state/stepsAtom"
import { variablesAtom } from "../../state/variablesAtom"

export const LoadModal = () => {
  const [isOpen, setIsOpen] = useAtom(loadModalOpenAtom)
  const isAutoPasting = useAtomValue(
    loadModalAutoPastingAtom,
  )
  const setSteps = useSetAtom(stepsAtom)
  // Write to variablesAtom (not pathsAtom): result.paths can include any
  // variable type (path, dvdCompareId, threadCount, …). Writing through
  // pathsAtom would drop non-path types on every YAML load.
  const setVariables = useSetAtom(variablesAtom)
  const currentPaths = useAtomValue(pathsAtom)
  const commands = useAtomValue(commandsAtom)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setIsOpen(false)
    setError(null)
  }

  // Shared loader used by both the Ctrl+V paste handler and the
  // on-open auto-paste effect. Returns true on success so callers
  // can decide what to do with the modal afterward.
  const tryLoadYaml = useCallback(
    (text: string, { isSilent }: { isSilent: boolean }) => {
      if (!text.trim()) return false
      try {
        const result = loadYamlFromText(
          text,
          commands,
          currentPaths,
        )
        setSteps(result.steps)
        setVariables(result.paths)
        setIsOpen(false)
        return true
      } catch (err) {
        if (!isSilent) {
          setError(
            err instanceof Error
              ? err.message
              : "Unknown error",
          )
        }
        return false
      }
    },
    [
      commands,
      currentPaths,
      setSteps,
      setVariables,
      setIsOpen,
    ],
  )

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
      tryLoadYaml(text, { isSilent: false })
    }

    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("paste", handlePaste)
    }
  }, [isOpen, tryLoadYaml])

  return (
    <Dialog
      heading="Load YAML"
      isVisible={isOpen && !isAutoPasting}
      onClose={close}
      size="sm"
    >
      <div className="px-2 py-4 text-center space-y-3">
        <p className="text-sm text-content-secondary">
          Paste your saved sequence YAML anywhere on the
          page.
        </p>
        <p className="text-xs text-content-muted">
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-surface-sunken border border-border-default rounded font-mono text-[10px]">
            Ctrl + V
          </kbd>{" "}
          /{" "}
          <kbd className="px-1.5 py-0.5 bg-surface-sunken border border-border-default rounded font-mono text-[10px]">
            ⌘ + V
          </kbd>{" "}
          to paste ·{" "}
          <kbd className="px-1.5 py-0.5 bg-surface-sunken border border-border-default rounded font-mono text-[10px]">
            Esc
          </kbd>{" "}
          to cancel
        </p>
        {error !== null && (
          <p
            role="alert"
            className="text-xs text-intent-danger-content"
          >
            {error}
          </p>
        )}
      </div>
    </Dialog>
  )
}
