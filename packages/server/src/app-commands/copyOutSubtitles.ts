// @deprecated — use `extractSubtitles` instead. This module is a thin
// shim that delegates to the canonical implementation while logging a
// one-time deprecation warning per call. Will be removed in a future
// release once existing sequences and saved configs have migrated.

import { logWarning } from "../tools/logMessage.js"
import {
  type ExtractSubtitlesProps,
  extractSubtitles,
  extractSubtitlesDefaultProps,
} from "./extractSubtitles.js"

export type CopyOutSubtitlesProps = ExtractSubtitlesProps

export const copyOutSubtitlesDefaultProps =
  extractSubtitlesDefaultProps

/** @deprecated Use `extractSubtitles` instead. */
export const copyOutSubtitles = (
  props: CopyOutSubtitlesProps,
) => {
  logWarning(
    "copyOutSubtitles",
    "DEPRECATED: 'copyOutSubtitles' was renamed to 'extractSubtitles'. Update your sequences / CLI calls; the old name will be removed in a future release.",
  )
  return extractSubtitles(props)
}
