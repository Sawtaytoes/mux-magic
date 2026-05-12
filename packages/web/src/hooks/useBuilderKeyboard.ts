import { useEffect, useRef } from "react"

import { useBuilderActions } from "./useBuilderActions"

export const useBuilderKeyboard = () => {
  const { undo, redo } = useBuilderActions()
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
}
