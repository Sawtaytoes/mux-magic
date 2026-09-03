import { useStore } from "jotai"
import { useCallback, useEffect, useRef } from "react"

import { loadYamlFromText } from "../jobs/yamlCodec"
import { commandsAtom } from "../state/commandsAtom"
import { pathsAtom } from "../state/pathsAtom"
import { stepsAtom } from "../state/stepsAtom"
import { variablesAtom } from "../state/variablesAtom"
import { useBuilderActions } from "./useBuilderActions"

const isEditablePasteTarget = (event: ClipboardEvent) =>
  event
    .composedPath()
    .some(
      (target) =>
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement &&
          target.isContentEditable),
    )

export const useBuilderKeyboard = () => {
  const { undo, redo } = useBuilderActions()
  const store = useStore()
  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (
        !event.defaultPrevented &&
        !isEditablePasteTarget(event)
      ) {
        const text =
          event.clipboardData?.getData("text/plain") ?? ""

        if (text.trim()) {
          try {
            const result = loadYamlFromText(
              text,
              store.get(commandsAtom),
              store.get(pathsAtom),
            )
            event.preventDefault()
            store.set(stepsAtom, result.steps)
            store.set(variablesAtom, result.paths)
          } catch {
            // A paste that is not valid Mux-Magic YAML keeps its normal
            // browser behavior.
          }
        }
      }
    },
    [store],
  )
  const shortcutsRef = useRef<
    ((event: KeyboardEvent) => void) | undefined
  >(undefined)

  useEffect(() => {
    shortcutsRef.current = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return

      if (
        event.key === "z" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault()
        if (event.shiftKey) {
          void redo()
        } else {
          void undo()
        }
      } else if (
        event.key === "y" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault()
        void redo()
      }
    }

    const handler = (event: KeyboardEvent) =>
      shortcutsRef.current?.(event)
    document.addEventListener("keydown", handler)
    return () =>
      document.removeEventListener("keydown", handler)
  }, [undo, redo])

  useEffect(() => {
    window.addEventListener("paste", handlePaste)
    return () => {
      window.removeEventListener("paste", handlePaste)
    }
  }, [handlePaste])
}
