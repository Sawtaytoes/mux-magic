import type {
  JobLogDoneEvent,
  JobLogsEvent,
} from "@mux-magic/server/api-types"
import { useSetAtom } from "jotai"
import { useCallback, useEffect, useRef } from "react"
import { apiBase } from "../apiBase"
import { mergeProgress } from "../jobs/mergeProgress"
import type { LogEntry } from "../state/logsByJobIdAtom"
import { logsByJobIdAtom } from "../state/logsByJobIdAtom"
import { progressByJobIdAtom } from "../state/progressByJobIdAtom"

// Terminal payload the SSE stream delivers when a job finishes. Matches
// the server's wire shape directly so adding/removing fields server-side
// fails web typecheck on consumers like StepCard.
export type LogStreamDonePayload = JobLogDoneEvent

// Opens /jobs/:id/logs on demand and pipes lines + progress into shared atoms.
// Deduplicates log lines using the SSE lastEventId so server replay-from-0
// on reconnect doesn't re-append already-seen lines.
export const useLogStream = (
  jobId: string,
  onDone?: (payload: LogStreamDonePayload) => void,
) => {
  const setLogs = useSetAtom(logsByJobIdAtom)
  const setProgress = useSetAtom(progressByJobIdAtom)
  const esRef = useRef<EventSource | null>(null)
  const lastLogIndexRef = useRef<number | undefined>(
    undefined,
  )
  const unmountedRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const connect = useCallback(() => {
    if (esRef.current !== null) return

    const es = new EventSource(
      `${apiBase}/jobs/${jobId}/logs`,
    )
    esRef.current = es

    es.onmessage = (event: MessageEvent) => {
      let data: JobLogsEvent
      try {
        data = JSON.parse(event.data) as JobLogsEvent
      } catch {
        return
      }

      if ("line" in data && typeof data.line === "string") {
        const rawId = event.lastEventId
        if (
          rawId !== "" &&
          rawId !== null &&
          rawId !== undefined
        ) {
          const idNum = Number(rawId)
          if (Number.isFinite(idNum)) {
            if (
              lastLogIndexRef.current !== undefined &&
              idNum <= lastLogIndexRef.current
            ) {
              return
            }
            lastLogIndexRef.current = idNum
          }
        }
        const { line } = data
        setLogs((prev) => {
          const next = new Map(prev)
          const entries = next.get(jobId) ?? []
          const key = rawId || String(entries.length)
          const entry: LogEntry = { key, line }
          next.set(jobId, [...entries, entry])
          return next
        })
      } else if (
        "type" in data &&
        data.type === "progress"
      ) {
        // Server's ProgressEvent has `ratio: number | null`;
        // mergeProgress expects `ratio?: number` (null is meaningless to
        // the bar). Coerce null â†’ undefined at the SSE boundary so the
        // merged snapshot stays clean.
        const progressEvent = {
          ratio: data.ratio ?? undefined,
          filesDone: data.filesDone,
          filesTotal: data.filesTotal,
          currentFiles: data.currentFiles?.map((file) => ({
            path: file.path,
            ratio: file.ratio ?? undefined,
          })),
        }
        setProgress((prev) => {
          const next = new Map(prev)
          next.set(
            jobId,
            mergeProgress(prev.get(jobId), progressEvent),
          )
          return next
        })
      } else if ("isDone" in data && data.isDone) {
        es.close()
        esRef.current = null
        onDoneRef.current?.(data)
      }
    }

    es.onerror = () => {
      if (
        es.readyState === EventSource.CLOSED &&
        !unmountedRef.current
      ) {
        esRef.current = null
      }
    }
  }, [jobId, setLogs, setProgress])

  useEffect(
    () => () => {
      unmountedRef.current = true
      esRef.current?.close()
      esRef.current = null
    },
    [],
  )

  return { connect }
}
