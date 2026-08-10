import { IconButton } from "@charcuterie/ui"
import { useAtom } from "jotai"
import { useEffect } from "react"
import { streamUrl } from "../../streamUrl"
import { audioPreviewModalAtom } from "./audioPreviewModalAtom"

// Lightweight peer of VideoPreviewModal. Browsers play the supported
// extension list (.flac/.mp3/.wav/.m4a/.ogg/.opus/.aac/.aif/.aiff)
// natively via <audio>; HTTP Range on /files/stream provides seek.
// ffmpeg transcoding for unsupported codecs is out of scope here —
// the modal renders a stub message if the element fails to load.
export const AudioPreviewModal = () => {
  const [audioPreview, setAudioPreview] = useAtom(
    audioPreviewModalAtom,
  )

  useEffect(() => {
    if (!audioPreview) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setAudioPreview(null)
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
  }, [audioPreview, setAudioPreview])

  if (!audioPreview) return null
  const { path } = audioPreview
  const onClose = () => setAudioPreview(null)

  return (
    <div
      role="none"
      id="audio-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="bg-surface-raised border border-border-default rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default shrink-0">
          <span
            id="audio-modal-name"
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
        <div className="p-4 bg-surface-sunken">
          {/** biome-ignore lint/a11y/useMediaCaption: native preview of an arbitrary audio file from the file explorer — no captions available. */}
          <audio
            id="audio-modal-player"
            controls
            autoPlay
            preload="metadata"
            src={streamUrl(path)}
            className="w-full"
          />
          <noscript>
            Your browser can't play this file — transcode
            (coming later).
          </noscript>
        </div>
      </div>
    </div>
  )
}
