import type {
  JobLogsEvent,
  JobStatus,
} from "@media-tools/server/api-types"
import { useAtom, useSetAtom } from "jotai"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { apiRunModalAtom } from "../../components/ApiRunModal/apiRunModalAtom"
import { promptModalAtom } from "../../components/PromptModal/promptModalAtom"
import { useTolerantEventSource } from "../../hooks/useTolerantEventSource"
import { Modal } from "../../primitives/Modal/Modal"
import { runningAtom } from "../../state/runAtoms"
import { setStepRunStatusAtom } from "../../state/stepAtoms"
import { ChildProgressTracker } from "../ChildProgressTracker/ChildProgressTracker"

// ─── Status badge colours ─────────────────────────────────────────────────────

const STATUS_CLASSES: Record<JobStatus, string> = {
  pending: "bg-slate-700 text-slate-300",
  running: "bg-amber-700 text-amber-100",
  completed: "bg-emerald-700 text-emerald-100",
  failed: "bg-red-700 text-red-100",
  cancelled: "bg-slate-600 text-slate-100",
  skipped: "bg-slate-500 text-slate-100",
}

export const ApiRunModal = () => {
  const [modalState, setModalState] =
    useAtom(apiRunModalAtom)
  const _setPromptData = useSetAtom(promptModalAtom)
  const setRunning = useSetAtom(runningAtom)
  const setStepRunStatus = useSetAtom(setStepRunStatusAtom)

  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<JobStatus>("pending")
  const [seqDone, setSeqDone] = useState(false)

  const logsEndRef = useRef<HTMLDivElement>(null)
  const prevModalJobIdRef = useRef<
    string | null | undefined
  >(undefined)

  // Auto-scroll logs to bottom on new lines.
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({
      behavior: "smooth",
    })
  }, [])

  // Sync status + log reset when a new job opens.
  // prevModalJobIdRef guards against re-running (and clearing logs)
  // when modalState updates for reasons other than a new job opening.
  useEffect(() => {
    if (!modalState) return
    if (prevModalJobIdRef.current === modalState.jobId)
      return
    prevModalJobIdRef.current = modalState.jobId
    setStatus(modalState.status)
    setLogs([])
    setSeqDone(false)
  }, [modalState])

  const parentUrl = modalState?.jobId
    ? `/jobs/${modalState.jobId}/logs`
    : null

  // ─── Parent SSE (sequence-level events) ────────────────────────────────────

  const handleParentMessage = useCallback(
    (data: JobLogsEvent) => {
      if ("type" in data && data.type === "step-started") {
        const startedStepId = data.stepId
        const childJobId = data.childJobId
        if (startedStepId) {
          setModalState((prev) =>
            prev
              ? {
                  ...prev,
                  activeChildren: [
                    ...prev.activeChildren,
                    {
                      stepId: startedStepId,
                      jobId: childJobId,
                    },
                  ],
                }
              : prev,
          )
          setStepRunStatus({
            stepId: startedStepId,
            status: "running",
            jobId: childJobId,
          })
        }
        return
      }
      if ("type" in data && data.type === "step-finished") {
        if (data.stepId) {
          const finishedStepId = data.stepId
          setModalState((prev) =>
            prev
              ? {
                  ...prev,
                  activeChildren:
                    prev.activeChildren.filter(
                      (child) =>
                        child.stepId !== finishedStepId,
                    ),
                }
              : prev,
          )
          setStepRunStatus({
            stepId: finishedStepId,
            status: data.status,
            jobId: null,
          })
        }
        return
      }
      if ("line" in data) {
        const lineEvent = data
        setLogs((prev) => [...prev, lineEvent.line])
        return
      }
      if ("done" in data && data.done) {
        setStatus(data.status)
        setModalState((prev) =>
          prev ? { ...prev, activeChildren: [] } : prev,
        )
        setSeqDone(true)
        setRunning(false)
      }
    },
    [setRunning, setStepRunStatus, setModalState],
  )

  const handleParentDisconnected = useCallback(() => {
    setStatus("failed")
    setModalState((prev) =>
      prev ? { ...prev, activeChildren: [] } : prev,
    )
    setRunning(false)
  }, [setRunning, setModalState])

  useTolerantEventSource<JobLogsEvent>({
    url: parentUrl ?? "",
    enabled: parentUrl !== null && !seqDone,
    onMessage: handleParentMessage,
    onPossiblyDisconnected: handleParentDisconnected,
  })

  const close = useCallback(async () => {
    const jobId = modalState?.jobId
    if (jobId && status === "running") {
      try {
        await fetch(`/jobs/${jobId}`, { method: "DELETE" })
      } catch {
        // Best-effort cancel.
      }
    }
    setModalState(null)
    setRunning(false)
  }, [modalState?.jobId, status, setModalState, setRunning])

  const cancel = useCallback(async () => {
    if (!modalState?.jobId) return
    try {
      await fetch(`/jobs/${modalState.jobId}`, {
        method: "DELETE",
      })
    } catch {
      // Best-effort.
    }
  }, [modalState?.jobId])

  const copyLogs = useCallback(async () => {
    const text = logs.join("\n")
    const btn = document.getElementById(
      "api-run-copy-btn",
    ) as HTMLButtonElement | null
    const original = btn?.textContent ?? "Copy logs"
    try {
      await navigator.clipboard.writeText(text)
      if (btn) btn.textContent = "✓ Copied"
    } catch {
      if (btn) btn.textContent = "✗ Failed"
    }
    setTimeout(() => {
      if (btn) btn.textContent = original
    }, 1200)
  }, [logs])

  const statusClass =
    STATUS_CLASSES[status] ?? "bg-slate-700 text-slate-300"

  const activeChildren = modalState?.activeChildren ?? []

  const modalTitle =
    modalState?.source === "step"
      ? "Run Step"
      : "Run Sequence"

  return (
    <Modal
      isOpen={Boolean(modalState)}
      onClose={() => {
        void close()
      }}
      ariaLabel={modalTitle}
    >
      {modalState && (
        <div
          id="api-run-modal"
          className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col gap-0 overflow-hidden max-h-[85dvh]"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 shrink-0">
            <span className="text-slate-300 text-sm font-medium">
              {modalTitle}
            </span>
            {modalState.jobId && (
              <span
                id="api-run-jobid"
                className="text-xs text-slate-500 font-mono"
              >
                job {modalState.jobId}
              </span>
            )}
            <span
              id="api-run-status"
              className={`text-xs px-2 py-0.5 rounded font-mono ml-auto ${statusClass}`}
            >
              {status}
            </span>
            {status === "running" && (
              <button
                type="button"
                id="api-run-cancel-btn"
                onClick={() => void cancel()}
                className="text-xs bg-red-700 hover:bg-red-600 text-white px-2 py-0.5 rounded font-medium"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => void close()}
              className="text-slate-400 hover:text-white text-base leading-none ml-1"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Active child step progress bars */}
          {activeChildren.length > 0 && (
            <div className="overflow-y-auto max-h-48 shrink-0">
              {activeChildren.map((child) =>
                child.jobId ? (
                  <ChildProgressTracker
                    key={child.stepId}
                    stepId={child.stepId}
                    jobId={child.jobId}
                  />
                ) : null,
              )}
            </div>
          )}

          {/* Log output */}
          <pre
            id="api-run-logs"
            className="flex-1 overflow-y-auto text-xs font-mono text-slate-300 px-4 py-3 whitespace-pre-wrap wrap-break-word min-h-0"
          >
            {logs.join("\n")}
            <div ref={logsEndRef} />
          </pre>

          {/* Footer */}
          <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-700 shrink-0">
            <button
              type="button"
              id="api-run-copy-btn"
              onClick={() => void copyLogs()}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded border border-slate-600"
            >
              Copy logs
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
