import { Modal as CharcuterieModal } from "@charcuterie/ui"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  ariaLabel: string
  children: React.ReactNode
}

// Thin wrapper preserving the app's historical Modal prop API
// ({ isOpen, onClose, ariaLabel, children }) while delegating the
// overlay/scrim/focus-trap/scroll-lock/token backdrop to Charcuterie's
// bare Modal. Prop mapping: isOpen -> isVisible, ariaLabel -> aria-label.
export const Modal = ({
  isOpen,
  onClose,
  ariaLabel,
  children,
}: ModalProps) => {
  return (
    <CharcuterieModal
      isVisible={isOpen}
      onClose={onClose}
      aria-label={ariaLabel}
    >
      {children}
    </CharcuterieModal>
  )
}
