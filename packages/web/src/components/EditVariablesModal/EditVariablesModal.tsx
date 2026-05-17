import { useAtom } from "jotai"
import { useEffect } from "react"
import { Modal } from "../../primitives/Modal/Modal"
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
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      ariaLabel="Edit Variables"
    >
      <div
        id="edit-variables-modal"
        className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-slate-100">
            Variables
          </h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-200 w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <VariablesPanel />
        </div>
      </div>
    </Modal>
  )
}
