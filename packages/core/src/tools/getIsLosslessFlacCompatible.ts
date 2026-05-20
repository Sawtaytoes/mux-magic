import { type FileInfo } from "@mux-magic/tools"
import { type Observable, of } from "rxjs"

export type LosslessFlacSkipReason = "dsd" | "float-pcm"

export type GetIsLosslessFlacCompatibleResult =
  | { fileInfo: FileInfo; kind: "compatible" }
  | { kind: "skip"; reason: LosslessFlacSkipReason }

// Stub: always-compatible. Real probe via getMediaInfo lands in the
// green commit alongside the pipeline rewrite.
export const getIsLosslessFlacCompatible = (
  fileInfo: FileInfo,
): Observable<GetIsLosslessFlacCompatibleResult> =>
  of({ fileInfo, kind: "compatible" })
