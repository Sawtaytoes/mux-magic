import { useState } from "react"
import { formatGenericResults } from "./formatGenericResults"

// Catch-all post-run results panel. Renders whatever the command
// emitted on its observable in a shape sensible for the data: an
// audio-offset list (filename: Nms), a rename arrow list (from →
// to), a path list, or a JSON dump as a last resort. Specialized
// renderers (NSF, ConvertLossless) own their own commands and run
// first; this component opts out for those so we don't double-render.
//
// Visual style matches the ConvertLossless emerald summary panel so
// the user sees "what was touched" consistently across cards.

const SPECIALIZED_RENDERER_COMMANDS = new Set<string>([
  "convertLosslessToFlac",
  "nameSpecialFeatures",
  "nameSpecialFeaturesDvdCompareTmdb",
])

const headingByKind: Record<string, string> = {
  audioOffsets: "Audio offsets",
  renames: "Renamed",
  paths: "Touched",
  json: "Result",
}

type Props = {
  commandName: string
  results: ReadonlyArray<unknown> | null | undefined
}

export const GenericRunResults = ({
  commandName,
  results,
}: Props) => {
  const [isOpen, setIsOpen] = useState(true)

  if (SPECIALIZED_RENDERER_COMMANDS.has(commandName)) {
    return null
  }

  const view = formatGenericResults(results)
  if (view.kind === "empty") {
    return null
  }

  const heading = headingByKind[view.kind] ?? "Result"
  const count =
    view.kind === "json" ? null : view.rows.length

  return (
    <details
      data-generic-run-results
      data-kind={view.kind}
      open={isOpen}
      onToggle={(event) =>
        setIsOpen(
          (event.currentTarget as HTMLDetailsElement).open,
        )
      }
      className="rounded border border-emerald-800/40 bg-emerald-950/30 text-xs"
    >
      <summary className="cursor-pointer px-2 py-1 text-emerald-300">
        {heading}
        {count !== null ? ` (${count})` : ""}
      </summary>
      <div className="px-3 py-2 font-mono text-emerald-200/90 break-all">
        {view.kind === "audioOffsets" && (
          <ul className="space-y-1">
            {view.rows.map((row) => (
              <li
                key={`${row.label}:${row.offsetInMilliseconds}`}
              >
                {row.label}
                <span className="text-emerald-500">
                  {": "}
                </span>
                {row.offsetInMilliseconds}ms
              </li>
            ))}
          </ul>
        )}
        {view.kind === "renames" && (
          <ul className="space-y-1">
            {view.rows.map((row) => (
              <li key={`${row.fromValue}→${row.toValue}`}>
                {row.fromValue}
                <span className="text-emerald-500">
                  {" → "}
                </span>
                {row.toValue}
              </li>
            ))}
          </ul>
        )}
        {view.kind === "paths" && (
          <ul className="space-y-1">
            {view.rows.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        )}
        {view.kind === "json" && (
          <pre className="whitespace-pre-wrap">
            {view.text}
          </pre>
        )}
      </div>
    </details>
  )
}
