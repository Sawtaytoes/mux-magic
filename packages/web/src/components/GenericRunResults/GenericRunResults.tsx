import { Accordion } from "@charcuterie/ui"

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
  // The no-TMDB sibling emits the same `{ oldName, newName }` renames
  // and (since it grew a summary trailer) the same unnamed-file report,
  // so `NsfRunResults` owns its output too. Without this it was listed
  // twice — once as the NSF rename list, once as this panel's generic
  // "Renamed" accordion.
  "onlyNameSpecialFeaturesDvdCompare",
  // `MusicMatchRunResults` owns this one. Its records are per-file rows
  // carrying a whole ranked candidate set; the generic JSON dump renders
  // them as an unreadable wall and hides the Review Tags button under it.
  "matchMusicRelease",
  "matchMusicBrainzRelease",
  "matchVgmdbRelease",
  "matchFreedbRelease",
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
    <Accordion
      className="border-intent-success-border bg-intent-success-surface text-xs"
      expandedKeys={[view.kind]}
      items={[
        {
          content: (
            <div className="break-all font-mono text-intent-success-content">
              {view.kind === "audioOffsets" && (
                <ul className="space-y-1">
                  {view.rows.map((row) => (
                    <li
                      key={`${row.label}:${row.offsetInMilliseconds}`}
                    >
                      {row.label}
                      <span className="text-intent-success-content">
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
                    <li
                      key={`${row.fromValue}→${row.toValue}`}
                    >
                      {row.fromValue}
                      <span className="text-intent-success-content">
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
          ),
          key: view.kind,
          label: `${heading}${count !== null ? ` (${count})` : ""}`,
        },
      ]}
    />
  )
}
