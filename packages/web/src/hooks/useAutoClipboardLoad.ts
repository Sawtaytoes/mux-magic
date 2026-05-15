import { useAtomValue, useSetAtom } from "jotai"
import { useCallback } from "react"
import { loadYamlFromText } from "../jobs/yamlCodec"
import { commandsAtom } from "../state/commandsAtom"
import { pathsAtom } from "../state/pathsAtom"
import { stepsAtom } from "../state/stepsAtom"
import { variablesAtom } from "../state/variablesAtom"

const looksLikeYaml = (text: string): boolean => {
  const trimmed = text.trim()
  if (!trimmed) return false
  return trimmed.includes(":") || trimmed.startsWith("-")
}

export const useAutoClipboardLoad = () => {
  const setSteps = useSetAtom(stepsAtom)
  // Write to variablesAtom so non-path variable types survive an auto-load
  // (post-worker-35).
  const setVariables = useSetAtom(variablesAtom)
  const currentPaths = useAtomValue(pathsAtom)
  const commands = useAtomValue(commandsAtom)

  return useCallback(async (): Promise<boolean> => {
    const readClipboard = navigator.clipboard?.readText
    if (typeof readClipboard !== "function") return false

    try {
      const text = await readClipboard.call(
        navigator.clipboard,
      )
      if (!looksLikeYaml(text)) return false

      const result = loadYamlFromText(
        text,
        commands,
        currentPaths,
      )
      setSteps(result.steps)
      setVariables(result.paths)
      return true
    } catch {
      return false
    }
  }, [commands, currentPaths, setSteps, setVariables])
}
