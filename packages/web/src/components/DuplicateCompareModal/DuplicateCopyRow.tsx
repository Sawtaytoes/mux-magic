import { Button } from "@charcuterie/ui"

import {
  type DuplicateCopy,
  formatQuality,
} from "./duplicateCompareTypes"

// One copy inside a duplicate group. The radio is the override: the
// server's recommendation arrives pre-selected, and picking a different
// row is how a human disagrees with it.
export const DuplicateCopyRow = ({
  copy,
  isKept,
  isReadOnly,
  onPlay,
  onSelectKeep,
}: {
  copy: DuplicateCopy
  isKept: boolean
  isReadOnly: boolean
  onPlay: () => void
  onSelectKeep: () => void
}) => (
  <div
    data-duplicate-copy
    data-is-kept={isKept}
    className={`flex flex-wrap items-center gap-2 rounded px-2 py-1.5 text-xs ${
      isKept
        ? "bg-intent-success-surface border border-intent-success-border"
        : "bg-surface-sunken border border-border-default"
    }`}
  >
    <label className="flex items-center gap-1.5">
      <input
        type="radio"
        checked={isKept}
        disabled={isReadOnly}
        onChange={onSelectKeep}
        aria-label={`Keep ${copy.filePath}`}
      />
      <span className="font-medium">
        {isKept ? "Keep" : "Move out"}
      </span>
    </label>
    <span className="font-mono wrap-break-word grow">
      {copy.filePath}
    </span>
    <span className="text-content-secondary">
      {formatQuality(copy.info)}
    </span>
    <Button
      intent="neutral"
      appearance="soft"
      size="sm"
      onClick={onPlay}
      title="Listen before deciding"
    >
      ▶
    </Button>
  </div>
)
