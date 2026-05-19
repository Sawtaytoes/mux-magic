import { useAtomValue } from "jotai"
import { useState } from "react"
import { logsByJobIdAtom } from "../../state/logsByJobIdAtom"

// Per-step log block. Renders the lines `useLogStream` already
// dropped into `logsByJobIdAtom` for this jobId; no extra SSE
// subscription needed. Defaults to collapsed so the card stays
// scannable; the user expands it when they want to see what
// happened, and can copy the whole buffer to the clipboard.
//
// Restores the legacy v1 builder's "card shows logs you can copy"
// behavior — the React port previously dropped this and surfaced
// logs only inside SequenceRunModal, which closes after every run.
type Props = {
  jobId: string
}

export const StepLogs = ({ jobId }: Props) => {
  const logsByJobId = useAtomValue(logsByJobIdAtom)
  const entries = logsByJobId.get(jobId) ?? []
  const [isExpanded, setIsExpanded] = useState(false)
  const [copyLabel, setCopyLabel] = useState<
    "Copy logs" | "✓ Copied" | "✗ Failed"
  >("Copy logs")

  if (entries.length === 0) {
    return null
  }

  const handleCopy = async () => {
    const text = entries
      .map((entry) => entry.line)
      .join("\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopyLabel("✓ Copied")
    } catch {
      setCopyLabel("✗ Failed")
    }
    setTimeout(() => {
      setCopyLabel("Copy logs")
    }, 1500)
  }

  return (
    <div
      data-step-logs
      className="flex flex-col gap-1"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="text-[10px] text-slate-400 hover:text-slate-200 font-mono"
        >
          {isExpanded ? "▾" : "▸"} Logs ({entries.length}{" "}
          line{entries.length === 1 ? "" : "s"})
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-0.5 rounded font-mono"
          title="Copy all log lines to clipboard"
        >
          📋 {copyLabel}
        </button>
      </div>
      {isExpanded && (
        <pre
          data-step-logs-body
          className="max-h-60 overflow-y-auto bg-slate-950 border border-slate-700 rounded text-[11px] text-slate-300 font-mono p-2 whitespace-pre-wrap wrap-break-word"
        >
          {entries.map((entry) => entry.line).join("\n")}
        </pre>
      )}
    </div>
  )
}
