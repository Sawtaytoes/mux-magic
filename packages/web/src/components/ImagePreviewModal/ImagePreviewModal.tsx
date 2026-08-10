import { IconButton } from "@charcuterie/ui"
import { useAtom } from "jotai"
import { useEffect } from "react"
import { streamUrl } from "../../streamUrl"
import { imagePreviewModalAtom } from "./imagePreviewModalAtom"

// Lightweight peer of VideoPreviewModal. Single-image render — no
// zoom/pan/lightbox (out of scope; see worker 78 spec). Same dismissal
// semantics as the video/audio peers: Escape, backdrop click, ✕ button.
export const ImagePreviewModal = () => {
  const [imagePreview, setImagePreview] = useAtom(
    imagePreviewModalAtom,
  )

  useEffect(() => {
    if (!imagePreview) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setImagePreview(null)
    }
    document.addEventListener("keydown", handleKeyDown, {
      capture: true,
    })
    return () =>
      document.removeEventListener(
        "keydown",
        handleKeyDown,
        { capture: true },
      )
  }, [imagePreview, setImagePreview])

  if (!imagePreview) return null
  const { path } = imagePreview
  const onClose = () => setImagePreview(null)

  return (
    <div
      role="none"
      id="image-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="bg-surface-raised border border-border-default rounded-xl shadow-2xl max-w-[90vw] mx-4 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default shrink-0">
          <span
            id="image-modal-name"
            className="text-xs text-content-secondary font-mono flex-1 truncate"
            title={path}
          >
            {path}
          </span>
          <IconButton
            label="Close"
            title="Close"
            intent="neutral"
            appearance="ghost"
            size="sm"
            className="ms-1"
            onClick={onClose}
          >
            ✕
          </IconButton>
        </div>
        <div className="p-2 bg-surface-sunken flex items-center justify-center">
          <img
            id="image-modal-img"
            src={streamUrl(path)}
            alt={path}
            className="max-w-full max-h-[80vh] object-contain"
          />
        </div>
      </div>
    </div>
  )
}
