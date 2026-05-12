import {
  formatBandwidth,
  formatEta,
} from "../../jobs/formatBandwidth"
import type { ProgressSnapshot } from "../../jobs/types"

export const ProgressLabel = ({
  snapshot,
}: {
  snapshot: ProgressSnapshot
}) => {
  const parts: string[] = []
  if (
    typeof snapshot.filesDone === "number" &&
    typeof snapshot.filesTotal === "number"
  ) {
    parts.push(
      `${snapshot.filesDone}/${snapshot.filesTotal} files`,
    )
  }
  if (typeof snapshot.ratio === "number") {
    parts.push(`${(snapshot.ratio * 100).toFixed(0)}%`)
  }
  const bw = formatBandwidth(snapshot.bytesPerSecond)
  if (bw) parts.push(bw)
  const eta = formatEta(
    snapshot.bytesRemaining,
    snapshot.bytesPerSecond,
  )
  if (eta) parts.push(eta)
  return (
    <div className="text-xs text-slate-400 mt-0.5">
      {parts.join(" · ")}
    </div>
  )
}
