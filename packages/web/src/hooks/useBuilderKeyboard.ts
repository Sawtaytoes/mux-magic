import { useEffect, useRef } from "react"

export const useBuilderKeyboard = () => {
  const shortcutsRef = useRef<(e: KeyboardEvent) => void>()

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
          window.mediaTools?.redo?.()
        } else {
          window.mediaTools?.undo?.()
        }
      } else if (
        event.key === "y" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault()
        window.mediaTools?.redo?.()
      }
    }

    const handler = (event: KeyboardEvent) =>
      shortcutsRef.current?.(event)
    document.addEventListener("keydown", handler)
    return () =>
      document.removeEventListener("keydown", handler)
  }, [])
}
