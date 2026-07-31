import { useAtomValue } from "jotai"
import { useState } from "react"

import { logsByJobIdAtom } from "../../state/logsByJobIdAtom"
import { DisclosedLogViewer } from "../DisclosedLogViewer/DisclosedLogViewer"

// Per-step log block. Renders the lines `useLogStream` already
// dropped into `logsByJobIdAtom` for this jobId; no extra SSE
// subscription needed. Defaults to collapsed so the card stays
// scannable; the user expands it when they want to see what
// happened, and can copy the whole buffer to the clipboard.
//
// Restores the legacy v1 builder's "card shows logs you can copy"
// behavior — the React port previously dropped this and surfaced
// logs only inside SequenceRunModal, which closes after every run.
//
// The pane used to be a `<pre>` holding the whole buffer joined into one
// text node, with no following at all and no cap — a step that emits for an
// hour rendered every line and the pane never moved. `data-step-logs-body`
// went with it: a handle only the suite could see, replaced by the pane's
// accessible name.
type Props = {
  jobId: string
}

export const StepLogs = ({ jobId }: Props) => {
  const logsByJobId = useAtomValue(logsByJobIdAtom)
  const entries = logsByJobId.get(jobId) ?? []
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
    <DisclosedLogViewer
      actions={
        <button
          className="rounded bg-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-200 hover:bg-slate-600"
          onClick={() => void handleCopy()}
          title="Copy all log lines to clipboard"
          type="button"
        >
          📋 {copyLabel}
        </button>
      }
      label={`Logs for step ${jobId}`}
      lines={entries.map((entry) => ({
        key: entry.key,
        text: entry.line,
      }))}
      summary={`Logs (${entries.length} line${entries.length === 1 ? "" : "s"})`}
    />
  )
}
