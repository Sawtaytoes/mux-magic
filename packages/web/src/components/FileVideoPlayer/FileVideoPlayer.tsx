import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { apiBase } from "../../apiBase"
import { useIsContainerized } from "../../hooks/useIsContainerized"
import { streamUrl } from "../../streamUrl"

const BROWSER_UNSUPPORTED_AUDIO = new Set([
  "ac-3",
  "dts",
  "e-ac-3",
  "eac3",
  "mlp",
  "mlp fba",
  "pcm",
  "truehd",
])

type FileVideoPlayerProps = {
  path: string | null
  onClose: () => void
}

export const FileVideoPlayer = ({
  path,
  onClose,
}: FileVideoPlayerProps) => {
  const playerRef = useRef<HTMLVideoElement>(null)
  const mseCleanupRef = useRef<(() => void) | null>(null)
  const [isStatusVisible, setIsStatusVisible] =
    useState(false)
  // Shared via the useIsContainerized hook so PromptModal,
  // FileVideoPlayer, and any other consumer share a single per-store
  // /version probe instead of each firing their own on mount.
  const isContainerized = useIsContainerized()
  // null = features not loaded yet → playback effect waits before
  // deciding which URL to use. Defaulting unloaded → null avoids the
  // race where setupPlayback runs once with a stale `false`, points
  // <video>.src at /files/stream, then re-runs to the transcode URL —
  // a visible flicker / double-load on first open.
  const [
    isFfmpegTranscodeEnabled,
    setIsFfmpegTranscodeEnabled,
  ] = useState<boolean | null>(null)
  const [copyLabel, setCopyLabel] = useState("📋 Copy path")
  const [openLabel, setOpenLabel] = useState(
    "⬡ Open in player",
  )

  const clearMse = useCallback(() => {
    mseCleanupRef.current?.()
    mseCleanupRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      clearMse()
      const player = playerRef.current
      if (player) {
        player.pause()
        player.removeAttribute("src")
        player.load()
      }
    }
  }, [clearMse])

  useEffect(() => {
    // /version is now probed by useIsContainerized; this effect only
    // loads /features (the experimental-transcode flag).
    //
    // Mirror the server-side default (false) on /features fetch failure
    // so a flaky probe never accidentally turns the experimental
    // transcode path on for the user. The flag's docstring in
    // featuresRoutes.ts explicitly calls out the seek / InvalidStateError
    // bugs that gate it.
    fetch(`${apiBase}/features`, { cache: "no-store" })
      .then((resp) => resp.json())
      .then(
        (data: {
          isExperimentalFfmpegTranscodingEnabled?: boolean
        }) => {
          setIsFfmpegTranscodeEnabled(
            data.isExperimentalFfmpegTranscodingEnabled ===
              true,
          )
        },
      )
      .catch(() => setIsFfmpegTranscodeEnabled(false))
  }, [])

  useEffect(() => {
    if (!path || !playerRef.current) return
    // Wait for /features to land before deciding /files/stream vs
    // /transcode/audio. See the state declaration above for why null
    // matters here (avoids a first-render flicker).
    if (isFfmpegTranscodeEnabled === null) return
    const player = playerRef.current
    clearMse()
    player.pause()
    player.src = ""

    const setupPlayback = async () => {
      // The audio-codec probe is only meaningful when the transcode
      // path is reachable — when the flag is off, the answer always
      // routes to /files/stream regardless, so skip the round-trip.
      let isNeedingTranscode = false
      if (isFfmpegTranscodeEnabled) {
        let audioFormat: string | null = null
        try {
          const resp = await fetch(
            `${apiBase}/files/audio-codec?${new URLSearchParams({ path })}`,
            {
              cache: "no-store",
              signal: AbortSignal.timeout(30_000),
            },
          )
          if (resp.ok) {
            const data = (await resp.json()) as {
              audioFormat?: string
            }
            audioFormat = data.audioFormat ?? null
          }
        } catch {
          // Leave null — will use direct stream.
        }
        isNeedingTranscode =
          typeof audioFormat === "string" &&
          audioFormat.length > 0 &&
          BROWSER_UNSUPPORTED_AUDIO.has(
            audioFormat.toLowerCase(),
          )
      }

      // /files/stream is a seekable HTTP-Range route over the raw file
      // (see packages/api/src/api/routes/fileRoutes.ts:458-556); the
      // browser learns the real duration immediately and can scrub.
      // /transcode/audio is a live fMP4 mux from ffmpeg's stdout — only
      // valid when the MSE client is driving it, which is the
      // experimental path the flag protects.
      const playbackUrl = isNeedingTranscode
        ? `${apiBase}/transcode/audio?${new URLSearchParams({ path, codec: "opus" })}`
        : streamUrl(path)

      setIsStatusVisible(isNeedingTranscode)
      player.addEventListener(
        "canplay",
        () => setIsStatusVisible(false),
        {
          once: true,
        },
      )
      player.src = playbackUrl
      player.play().catch(() => {})
    }

    void setupPlayback()
  }, [path, clearMse, isFfmpegTranscodeEnabled])

  const handleCopyPath = async () => {
    if (!path) return
    try {
      await navigator.clipboard.writeText(path)
      setCopyLabel("✓ Copied")
    } catch {
      window.prompt("Copy this path manually:", path)
      return
    }
    setTimeout(() => setCopyLabel("📋 Copy path"), 1200)
  }

  const handleOpenExternal = async () => {
    if (!path) return
    setOpenLabel("⏳ Launching…")
    try {
      const resp = await fetch(
        `${apiBase}/files/open-external`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        },
      )
      const data = (await resp.json()) as {
        isOk: boolean
        error?: string
      }
      setOpenLabel(data.isOk ? "✓ Launched" : "✗ Failed")
    } catch {
      setOpenLabel("✗ Failed")
    }
    setTimeout(() => setOpenLabel("⬡ Open in player"), 1500)
  }

  if (!path) return null

  return (
    <div
      role="none"
      id="video-modal"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose()
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 shrink-0">
          <span
            id="video-modal-name"
            className="text-xs text-slate-400 font-mono flex-1 truncate"
            title={path}
          >
            {path}
          </span>
          {isStatusVisible && (
            <span
              id="video-modal-status"
              className="text-[10px] text-amber-300 bg-amber-900/40 border border-amber-700/50 px-1.5 py-0.5 rounded font-medium"
            >
              Transcoding audio…
            </span>
          )}
          <button
            type="button"
            id="video-modal-copy-path"
            onClick={() => void handleCopyPath()}
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-slate-700 hover:border-slate-600"
          >
            {copyLabel}
          </button>
          {!isContainerized && (
            <button
              type="button"
              id="video-modal-open-external"
              onClick={() => void handleOpenExternal()}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-slate-700 hover:border-slate-600"
            >
              {openLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-base leading-none ml-1"
            title="Close"
          >
            ✕
          </button>
        </div>
        <video
          id="video-modal-player"
          ref={playerRef}
          controls
          autoPlay
          className="w-full bg-black max-h-[75dvh]"
        >
          <track
            kind="captions"
            srcLang="en"
            label="Captions"
          />
        </video>
      </div>
    </div>
  )
}
