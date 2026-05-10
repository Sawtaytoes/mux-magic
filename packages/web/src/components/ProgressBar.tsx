import {
  formatBandwidth,
  formatEta,
} from "../jobs/formatBandwidth"
import type { ProgressSnapshot } from "../types"

interface ProgressBarProps {
  snapshot: ProgressSnapshot
}

const ProgressLabel = ({
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

const ProgressFileRow = ({
  path,
  ratio,
}: {
  path: string
  ratio?: number
}) => {
  const fileName = path.split(/[\\/]/).pop() ?? path
  const isIndeterminate = typeof ratio !== "number"
  const pct = !isIndeterminate
    ? `${
        // biome-ignore lint/style/noNonNullAssertion: suppressed during react-migration
        (Math.max(0, Math.min(1, ratio!)) * 100).toFixed(1)
      }%`
    : null
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="truncate flex-1 min-w-0" title={path}>
        {fileName}
      </div>
      <div className="shrink-0 w-8 text-right">
        {typeof ratio === "number"
          ? `${(ratio * 100).toFixed(0)}%`
          : ""}
      </div>
      <div className="shrink-0 w-20 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-blue-400 rounded-full ${isIndeterminate ? "animate-pulse w-full" : ""}`}
          style={pct !== null ? { width: pct } : undefined}
        />
      </div>
    </div>
  )
}

export const ProgressBar = ({
  snapshot,
}: ProgressBarProps) => {
  const ratio =
    typeof snapshot.ratio === "number"
      ? snapshot.ratio
      : null
  const isIndeterminate = ratio === null
  const pct =
    ratio !== null
      ? `${(Math.max(0, Math.min(1, ratio)) * 100).toFixed(1)}%`
      : null

  return (
    <div className="space-y-1" data-testid="progress-bar">
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-blue-500 rounded-full transition-all ${isIndeterminate ? "animate-pulse w-full" : ""}`}
          style={pct !== null ? { width: pct } : undefined}
          data-testid="progress-fill"
        />
      </div>
      <ProgressLabel snapshot={snapshot} />
      {snapshot.currentFiles &&
        snapshot.currentFiles.length > 0 && (
          <div className="space-y-0.5 pl-2 mt-1">
            {snapshot.currentFiles.map((file) => (
              <ProgressFileRow
                key={file.path}
                path={file.path}
                ratio={file.ratio}
              />
            ))}
          </div>
        )}
    </div>
  )
}
