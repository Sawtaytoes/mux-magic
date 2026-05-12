import { useSetAtom } from "jotai"
import { useCallback, useEffect, useRef } from "react"
import { mergeProgress } from "../jobs/mergeProgress"
import type { ProgressSnapshot } from "../jobs/types"
import type { LogEntry } from "../state/logsByJobIdAtom"
import { logsByJobIdAtom } from "../state/logsByJobIdAtom"
import { progressByJobIdAtom } from "../state/progressByJobIdAtom"

type LogEventData =
  | { line: string }
  | ({ type: "progress" } & Partial<ProgressSnapshot>)
  | { done: boolean }

// Opens /jobs/:id/logs on demand and pipes lines + progress into shared atoms.
// Deduplicates log lines using the SSE lastEventId so server replay-from-0
// on reconnect doesn't re-append already-seen lines.
export const useLogStream = (jobId: string) => {
  const setLogs = useSetAtom(logsByJobIdAtom)
  const setProgress = useSetAtom(progressByJobIdAtom)
  const esRef = useRef<EventSource | null>(null)
  const lastLogIndexRef = useRef<number | undefined>(
    undefined,
  )
  const unmountedRef = useRef(false)

  const connect = useCallback(() => {
    if (esRef.current !== null) return

    const es = new EventSource(`/jobs/${jobId}/logs`)
    esRef.current = es

    es.onmessage = (event: MessageEvent) => {
      let data: LogEventData
      try {
        data = JSON.parse(event.data) as LogEventData
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
        const progressEvent =
          data as Partial<ProgressSnapshot>
        setProgress((prev) => {
          const next = new Map(prev)
          next.set(
            jobId,
            mergeProgress(prev.get(jobId), progressEvent),
          )
          return next
        })
      } else if ("done" in data && data.done) {
        es.close()
        esRef.current = null
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
