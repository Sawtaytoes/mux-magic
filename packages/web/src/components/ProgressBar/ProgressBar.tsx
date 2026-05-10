import type { ProgressSnapshot } from "../../types"

import { ProgressFileRow } from "../ProgressFileRow/ProgressFileRow"
import { ProgressLabel } from "../ProgressLabel/ProgressLabel"

interface ProgressBarProps {
  snapshot: ProgressSnapshot
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
