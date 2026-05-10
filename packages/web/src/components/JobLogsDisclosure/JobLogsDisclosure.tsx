import { useAtomValue } from "jotai"
import { useEffect, useRef } from "react"

import { useLogStream } from "../../hooks/useLogStream"
import { logsByJobIdAtom } from "../../state/logsByJobIdAtom"
import { CopyTextButton } from "./CopyTextButton"

export const JobLogsDisclosure = ({
  jobId,
  jobStatus,
}: {
  jobId: string
  jobStatus: string
}) => {
  const logsByJobId = useAtomValue(logsByJobIdAtom)
  const lines = logsByJobId.get(jobId) ?? []
  const paneRef = useRef<HTMLDivElement>(null)
  const { connect } = useLogStream(jobId)

  useEffect(() => {
    if (jobStatus === "running") connect()
  }, [jobStatus, connect])

  useEffect(() => {
    const pane = paneRef.current
    if (pane) pane.scrollTop = pane.scrollHeight
  }, [])

  const handleToggle = (
    event: React.SyntheticEvent<HTMLDetailsElement>,
  ) => {
    if (event.currentTarget.open) connect()
  }

  return (
    <details onToggle={handleToggle}>
      <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200 py-1 flex items-center gap-1">
        Logs
        <CopyTextButton
          getText={() =>
            lines.map(({ line }) => line).join("\n")
          }
        />
      </summary>
      <div
        ref={paneRef}
        className="mt-1 max-h-40 overflow-y-auto bg-slate-950 rounded p-2 font-mono text-xs text-slate-300 space-y-0.5"
        data-log-id={jobId}
      >
        {lines.length === 0 ? (
          <div className="text-slate-500">
            Waiting for log lines…
          </div>
        ) : (
          lines.map(({ key, line }) => (
            <div key={key}>{line}</div>
          ))
        )}
      </div>
    </details>
  )
}
