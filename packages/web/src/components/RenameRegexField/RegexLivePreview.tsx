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
      <div className="mt-2 rounded border border-amber-700/60 bg-amber-950/40 px-2 py-1.5 text-[11px] text-amber-300">
        <span className="inline-block rounded bg-amber-800/60 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-[9px]">
          Invalid
        </span>{" "}
        <span className="font-mono">{result.message}</span>
      </div>
    )
  }

  if (result.state === "no-match") {
    return (
      <div className="mt-2 rounded border border-rose-800/60 bg-rose-950/40 px-2 py-1.5 text-[11px] text-rose-300">
        <span className="inline-block rounded bg-rose-800/60 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-[9px]">
          No match
        </span>{" "}
        <span className="font-mono text-rose-200/70">
          {result.compiledPattern}
        </span>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded border border-emerald-700/60 bg-emerald-950/40 px-2 py-1.5 text-[11px] text-emerald-200">
      <div>
        <span className="inline-block rounded bg-emerald-700/60 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-[9px]">
          Match
        </span>{" "}
        <span className="font-mono text-emerald-200/70">
          {result.compiledPattern}
        </span>
      </div>
      {hasOutput && result.output !== null && (
        <div className="mt-1">
          <span className="text-emerald-300/70">→ </span>
          <span className="font-mono text-emerald-100">
            {result.output}
          </span>
        </div>
      )}
      {result.groups.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {result.groups.map((group) => (
            <li
              key={group.name}
              className="font-mono text-emerald-200/80"
            >
              <span className="text-emerald-400/70">
                {`{ ${group.name}: `}
              </span>
              {`"${group.value}"`}
              <span className="text-emerald-400/70">
                {" }"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
