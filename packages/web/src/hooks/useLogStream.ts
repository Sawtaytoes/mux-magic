import type {
  JobLogDoneEvent,
  JobLogsEvent,
} from "@mux-magic/server/api-types"
import { useSetAtom } from "jotai"
import { useCallback, useEffect, useRef } from "react"
import { apiBase } from "../apiBase"
import { promptModalAtom } from "../components/PromptModal/promptModalAtom"
import { mergeProgress } from "../jobs/mergeProgress"
import type { LogEntry } from "../state/logsByJobIdAtom"
import { logsByJobIdAtom } from "../state/logsByJobIdAtom"
import { progressByJobIdAtom } from "../state/progressByJobIdAtom"

// Terminal payload the SSE stream delivers when a job finishes. Matches
// the server's wire shape directly so adding/removing fields server-side
// fails web typecheck on consumers like StepCard.
// eslint-disable-next-line no-restricted-syntax -- type alias for an already-imported server type; semantic rename for web consumers
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
  const setPromptData = useSetAtom(promptModalAtom)
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
      } else if ("type" in data && data.type === "prompt") {
        // Interactive prompt emitted by the command (e.g. "pick a category
        // for this special-feature file"). The pipeline is suspended on
        // the server until the user POSTs back to /jobs/:id/input — wiring
        // promptModalAtom here is what surfaces the picker. Without this
        // branch the event silently fell through and the job sat blocked.
        setPromptData({
          jobId,
          promptId: data.promptId,
          message: data.message,
          options: data.options,
          filePath: data.filePath,
          filePaths: data.filePaths,
        })
      } else if (
        "type" in data &&
        data.type === "progress"
      ) {
        // Server's ProgressEvent has `ratio: number | null`;
        // mergeProgress expects `ratio?: number` (null is meaningless to
        // the bar). Coerce null → undefined at the SSE boundary so the
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
        // If the job ended while a prompt was open (e.g. user cancelled
        // mid-prompt, or the pipeline errored before the user answered),
        // close the modal so the user isn't left with a picker that would
        // POST input back to a terminal job. The atom is global, so we
        // only clear it when it actually belongs to THIS job — otherwise
        // a finished job could wipe a prompt opened by a concurrent one.
        setPromptData((prev) =>
          prev && prev.jobId === jobId ? null : prev,
        )
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
  }, [jobId, setLogs, setProgress, setPromptData])

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
