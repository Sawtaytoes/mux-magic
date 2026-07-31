import { Accordion, LogViewer } from "@charcuterie/ui"
import { useAtomValue } from "jotai"
import { useEffect } from "react"

import { useLogStream } from "../../hooks/useLogStream"
import { logsByJobIdAtom } from "../../state/logsByJobIdAtom"
import { CopyTextButton } from "../CopyTextButton/CopyTextButton"

const LOGS_KEY = "logs"

/**
 * ### The auto-scroll that followed nothing
 *
 * ```tsx
 * useEffect(() => {
 *   const pane = paneRef.current
 *   if (pane) pane.scrollTop = pane.scrollHeight
 * }, [])          // ← empty deps
 * ```
 *
 * It ran **once**, on mount, when the pane was empty and `scrollHeight`
 * *was* `clientHeight`. Every line after that arrived below the fold, so a
 * running job's log never followed — and it reads as correct, which is why
 * it survived. `LogViewer` follows the tail and pins that following to the
 * user's own scroll position, with a **Jump to latest** button for when
 * they have scrolled away.
 *
 * ### `data-log-id` is gone
 *
 * It was a `data-testid` under another name — a handle only the suite could
 * see. The pane is found by its `label` now, which is the query Playwright
 * and a screen reader both make.
 *
 * ### The copy button left the summary
 *
 * `Accordion`'s trigger is a `<button>`, and a `<button>` inside a
 * `<button>` is invalid markup that browsers repair by hoisting the inner
 * one out of the trigger — so the copy control moved into the panel, where
 * it is also only reachable in the state where its text is on screen.
 */
export const JobLogsDisclosure = ({
  jobId,
  jobStatus,
}: {
  jobId: string
  jobStatus: string
}) => {
  const logsByJobId = useAtomValue(logsByJobIdAtom)
  const lines = logsByJobId.get(jobId) ?? []
  const { connect } = useLogStream(jobId)

  useEffect(() => {
    if (jobStatus === "running") {
      connect()
    }
  }, [jobStatus, connect])

  return (
    <Accordion
      items={[
        {
          content: (
            <div className="flex flex-col gap-1">
              <div className="flex justify-end">
                <CopyTextButton
                  getText={() =>
                    lines.map(({ line }) => line).join("\n")
                  }
                />
              </div>

              <LogViewer
                label={`Logs for job ${jobId}`}
                lines={lines.map(({ key, line }) => ({
                  key,
                  text: line,
                }))}
              />
            </div>
          ),
          key: LOGS_KEY,
          label: "Logs",
        },
      ]}
      onChange={(expandedKeys) => {
        if (expandedKeys.includes(LOGS_KEY)) {
          connect()
        }
      }}
    />
  )
}
