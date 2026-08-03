import { Accordion, LogViewer } from "@charcuterie/ui"
import { useAtomValue } from "jotai"
import { useState } from "react"

import { logsByJobIdAtom } from "../../state/logsByJobIdAtom"

const LOGS_KEY = "logs"

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
//
// The pane mounts inside the collapsed panel, which `AccordionSection`
// renders `hidden` rather than unmounting. That used to open the log on its
// first line — no layout box means `scrollHeight 0` for `LogViewer`'s mount
// effect — and a local `DisclosedLogViewer` withheld the pane until the
// section had been opened once. `@charcuterie/ui@1.0.0` fixed it upstream
// with a `ResizeObserver`, so the workaround is gone and these are the two
// library components directly.
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
    <Accordion
      items={[
        {
          content: (
            <div className="flex flex-col gap-1">
              {/*
                Above the pane rather than in the trigger: `Accordion`'s
                trigger is a `<button>`, and a `<button>` inside one is
                invalid markup browsers repair by hoisting it out.
              */}
              <div className="flex justify-end">
                <button
                  className="rounded bg-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-200 hover:bg-slate-600"
                  onClick={() => void handleCopy()}
                  title="Copy all log lines to clipboard"
                  type="button"
                >
                  📋 {copyLabel}
                </button>
              </div>

              <LogViewer
                label={`Logs for step ${jobId}`}
                lines={entries.map((entry) => ({
                  key: entry.key,
                  text: entry.line,
                }))}
              />
            </div>
          ),
          key: LOGS_KEY,
          label: `Logs (${entries.length} line${entries.length === 1 ? "" : "s"})`,
        },
      ]}
    />
  )
}
