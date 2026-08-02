import { useAtomValue } from "jotai"
import { useEffect } from "react"

import { useLogStream } from "../../hooks/useLogStream"
import { logsByJobIdAtom } from "../../state/logsByJobIdAtom"
import { CopyTextButton } from "../CopyTextButton/CopyTextButton"
import { DisclosedLogViewer } from "../DisclosedLogViewer/DisclosedLogViewer"

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
 * they have scrolled away. `DisclosedLogViewer` is what stops the same bug
 * arriving back through the accordion; see its docstring.
 *
 * ### `data-log-id` is gone
 *
 * It was a `data-testid` under another name — a handle only the suite could
 * see. The pane is found by its `label` now, which is the query Playwright
 * and a screen reader both make.
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
    <DisclosedLogViewer
      actions={
        <CopyTextButton
          getText={() =>
            lines.map(({ line }) => line).join("\n")
          }
        />
      }
      label={`Logs for job ${jobId}`}
      lines={lines.map(({ key, line }) => ({
        key,
        text: line,
      }))}
      onExpand={connect}
      summary="Logs"
    />
  )
}
