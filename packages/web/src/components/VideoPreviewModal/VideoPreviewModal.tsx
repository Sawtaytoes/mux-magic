import { useAtom } from "jotai"
import { videoPreviewModalAtom } from "../../components/VideoPreviewModal/videoPreviewModalAtom"
import { FileVideoPlayer } from "../FileVideoPlayer/FileVideoPlayer"

// Standalone, atom-driven host for the FileVideoPlayer overlay.
// Previously the player only mounted inside FileExplorerModal, which made
// `window.openVideoModal` a no-op whenever the explorer wasn't open
// (worker 58 / Part A). Mounting from BuilderPage decouples preview from
// any other modal's lifecycle.
export const VideoPreviewModal = () => {
  const [videoPreview, setVideoPreview] = useAtom(
    videoPreviewModalAtom,
  )
  if (!videoPreview) {
    return null
  }
  return (
    <FileVideoPlayer
      path={videoPreview.path}
      onClose={() => setVideoPreview(null)}
    />
  )
}
