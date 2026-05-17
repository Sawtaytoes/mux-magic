// @deprecated — use `addSubtitles` instead. This module is a thin shim
// that delegates to the canonical implementation while logging a one-time
// deprecation warning per call. Will be removed in a future release once
// existing sequences and saved configs have migrated. Renamed because the
// command only ever muxed in subtitles (and optional chapters) — it never
// touched audio or other track types, despite the historical name.

import { logWarning } from "@mux-magic/tools"
import {
  type AddSubtitlesProps,
  addSubtitles,
  addSubtitlesDefaultProps,
} from "./addSubtitles.js"

export type MergeTracksProps = AddSubtitlesProps

export const mergeTracksDefaultProps =
  addSubtitlesDefaultProps

/** @deprecated Use `addSubtitles` instead. */
export const mergeTracks = (props: MergeTracksProps) => {
  logWarning(
    "mergeTracks",
    "DEPRECATED: 'mergeTracks' was renamed to 'addSubtitles'. Update your sequences / CLI calls; the old name will be removed in a future release.",
  )
  return addSubtitles(props)
}
