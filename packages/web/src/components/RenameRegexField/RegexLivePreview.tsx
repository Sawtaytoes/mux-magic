import type { LivePreviewResult } from "./RegexFieldHelpers"

type RegexLivePreviewProps = {
  result: LivePreviewResult
  // Filters don't transform, so the "predicted output" line is hidden
  // for them. Renames pass `hasOutput={true}` to show the predicted
  // destination filename. Worker 65 §3.
  hasOutput: boolean
}

// Pure-presentation sub-component shared by RenameRegexField and
// RegexWithFlagsField. The parent runs `runLivePreview` and hands the
// result down; this component only renders.
export const RegexLivePreview = ({
  result,
  hasOutput,
}: RegexLivePreviewProps) => {
  if (result.state === "empty") return null

  if (result.state === "invalid") {
    return (
      <div className="mt-2 rounded border border-intent-warning-border bg-intent-warning-surface px-2 py-1.5 text-[11px] text-intent-warning-content">
        <span className="inline-block rounded bg-intent-warning-surface-hover px-1.5 py-0.5 font-semibold uppercase tracking-wider text-[9px]">
          Invalid
        </span>{" "}
        <span className="font-mono">{result.message}</span>
      </div>
    )
  }

  if (result.state === "no-match") {
    return (
      <div className="mt-2 rounded border border-intent-danger-border bg-intent-danger-surface px-2 py-1.5 text-[11px] text-intent-danger-content">
        <span className="inline-block rounded bg-intent-danger-surface-hover px-1.5 py-0.5 font-semibold uppercase tracking-wider text-[9px]">
          No match
        </span>{" "}
        <span className="font-mono text-intent-danger-content">
          {result.compiledPattern}
        </span>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded border border-intent-success-border bg-intent-success-surface px-2 py-1.5 text-[11px] text-intent-success-content">
      <div>
        <span className="inline-block rounded bg-intent-success-surface-hover px-1.5 py-0.5 font-semibold uppercase tracking-wider text-[9px]">
          Match
        </span>{" "}
        <span className="font-mono text-intent-success-content">
          {result.compiledPattern}
        </span>
      </div>
      {hasOutput && result.output !== null && (
        <div className="mt-1">
          <span className="text-intent-success-content">
            →{" "}
          </span>
          <span className="font-mono text-intent-success-content">
            {result.output}
          </span>
        </div>
      )}
      {result.groups.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {result.groups.map((group) => (
            <li
              key={group.name}
              className="font-mono text-intent-success-content"
            >
              <span className="text-intent-success-content">
                {`{ ${group.name}: `}
              </span>
              {`"${group.value}"`}
              <span className="text-intent-success-content">
                {" }"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
