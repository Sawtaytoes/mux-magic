import { Modal as CharcuterieModal } from "@charcuterie/ui"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  ariaLabel: string
  children: React.ReactNode
  // Composed onto Charcuterie's Modal box (the bordered/rounded/elevated
  // surface) — this is where a caller sets the modal's width, so the
  // content inside must NOT paint its own second surface.
  className?: string
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
  className,
}: ModalProps) => {
  return (
    <CharcuterieModal
      isVisible={isOpen}
      onClose={onClose}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </CharcuterieModal>
  )
}
