import { Dialog } from "@charcuterie/ui"
import { useAtom } from "jotai"
import { useEffect } from "react"
import { VariablesPanel } from "../VariablesPanel/VariablesPanel"
import { editVariablesModalOpenAtom } from "./editVariablesModalOpenAtom"

export const EditVariablesModal = () => {
  const [isOpen, setIsOpen] = useAtom(
    editVariablesModalOpenAtom,
  )

  // At lg+ (1024px) VariablesSidebar already renders VariablesPanel inline —
  // keeping this modal open at that width double-renders the editor.
  useEffect(() => {
    const mediaQueryList = window.matchMedia(
      "(min-width: 1024px)",
    )
    const closeIfWide = () => {
      if (mediaQueryList.matches) setIsOpen(false)
    }
    closeIfWide()
    mediaQueryList.addEventListener("change", closeIfWide)
    return () =>
      mediaQueryList.removeEventListener(
        "change",
        closeIfWide,
      )
  }, [setIsOpen])

  return (
    <Dialog
      heading="Edit Variables"
      isVisible={isOpen}
      onClose={() => setIsOpen(false)}
      size="lg"
    >
      <div id="edit-variables-modal">
        <VariablesPanel />
      </div>
    </Dialog>
  )
}
