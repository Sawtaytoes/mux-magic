import type {
  JobLogsEvent,
  JobStatus,
} from "@mux-magic/server/api-types"
import { useAtom, useSetAtom } from "jotai"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { apiBase } from "../../apiBase"
import { promptModalAtom } from "../../components/PromptModal/promptModalAtom"
import { useTolerantEventSource } from "../../hooks/useTolerantEventSource"
import { Modal } from "../../primitives/Modal/Modal"
import { runningAtom } from "../../state/runAtoms"
import { setStepRunStatusAtom } from "../../state/stepAtoms"
import { ChildProgressTracker } from "../ChildProgressTracker/ChildProgressTracker"
import { sequenceRunModalAtom } from "./sequenceRunModalAtom"

// ─── Status badge colours ─────────────────────────────────────────────────────

const STATUS_CLASSES: Record<JobStatus, string> = {
  pending: "bg-slate-700 text-slate-300",
  running: "bg-amber-700 text-amber-100",
  completed: "bg-emerald-700 text-emerald-100",
  failed: "bg-red-700 text-red-100",
  cancelled: "bg-slate-600 text-slate-100",
  skipped: "bg-slate-500 text-slate-100",
  exited: "bg-indigo-700 text-indigo-100",
}

export const SequenceRunModal = () => {
  const [modalState, setModalState] = useAtom(
    sequenceRunModalAtom,
  )
  const setPromptData = useSetAtom(promptModalAtom)
  const setRunning = useSetAtom(runningAtom)
  const setStepRunStatus = useSetAtom(setStepRunStatusAtom)

  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<JobStatus>("pending")
  const [isSeqDone, setIsSeqDone] = useState(false)

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
  useEffect(() => {
    if (modalState.mode === "closed") return
    if (prevModalJobIdRef.current === modalState.jobId)
      return
    prevModalJobIdRef.current = modalState.jobId
    setStatus(modalState.status)
    setLogs([])
    setIsSeqDone(false)
  }, [modalState])

  const jobId =
    modalState.mode !== "closed" ? modalState.jobId : null

  const parentUrl = jobId
    ? `${apiBase}/jobs/${jobId}/logs`
    : null

  // ─── Parent SSE (sequence-level events) ────────────────────────────────────

  const handleParentMessage = useCallback(
    (data: JobLogsEvent) => {
      if ("type" in data && data.type === "step-started") {
        const startedStepId = data.stepId
        const childJobId = data.childJobId
        if (startedStepId) {
          setModalState((prev) =>
            prev.mode !== "closed"
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
            prev.mode !== "closed"
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
            error: data.error ?? null,
          })
        }
        return
      }
      if ("type" in data && data.type === "prompt") {
        // Sequence-level prompt event (also routed up from a child step
        // via the umbrella SSE on the parent). Without this branch the
        // pipeline blocks server-side and the UI just shows logs/keepalives.
        // jobId on the modal payload is the umbrella's — PromptModal
        // submits to /jobs/<umbrella>/input, which the job runner routes
        // to the correct waiting child observable by promptId.
        const promptJobId = jobId
        if (promptJobId) {
          setPromptData({
            jobId: promptJobId,
            promptId: data.promptId,
            message: data.message,
            options: data.options,
            filePath: data.filePath,
            filePaths: data.filePaths,
          })
        }
        return
      }
      if ("line" in data) {
        setLogs((prev) => [...prev, data.line])
        return
      }
      if ("isDone" in data && data.isDone) {
        setStatus(data.status)
        setModalState((prev) =>
          prev.mode !== "closed"
            ? {
                ...prev,
                status: data.status,
                activeChildren: [],
              }
            : prev,
        )
        // Same stale-modal guard as useLogStream: clear the prompt if it
        // still belongs to the job that just terminated.
        const finishedJobId = jobId
        if (finishedJobId) {
          setPromptData((prev) =>
            prev && prev.jobId === finishedJobId
              ? null
              : prev,
          )
        }
        setIsSeqDone(true)
        setRunning(false)
      }
    },
    [
      jobId,
      setRunning,
      setStepRunStatus,
      setModalState,
      setPromptData,
    ],
  )

  const handleParentDisconnected = useCallback(() => {
    setStatus("failed")
    setModalState((prev) =>
      prev.mode !== "closed"
        ? { ...prev, activeChildren: [] }
        : prev,
    )
    setRunning(false)
  }, [setRunning, setModalState])

  useTolerantEventSource<JobLogsEvent>({
    url: parentUrl ?? "",
    isEnabled: parentUrl !== null && !isSeqDone,
    onMessage: handleParentMessage,
    onPossiblyDisconnected: handleParentDisconnected,
  })

  // ─── Actions ─────────────────────────────────────────────────────────────────

  // Send the modal to the background — the job keeps running, SSE stays alive.
  const sendToBackground = useCallback(() => {
    setModalState((prev) =>
      prev.mode !== "closed"
        ? { ...prev, mode: "background" }
        : prev,
    )
  }, [setModalState])

  // Cancel explicitly terminates the job server-side and closes the modal.
  const cancelJob = useCallback(async () => {
    const currentJobId = jobId
    if (currentJobId && status === "running") {
      try {
        await fetch(`${apiBase}/jobs/${currentJobId}`, {
          method: "DELETE",
        })
      } catch {
        // Best-effort cancel.
      }
    }
    setModalState({ mode: "closed" })
    setRunning(false)
  }, [jobId, status, setModalState, setRunning])

  const copyLogs = useCallback(async () => {
    const text = logs.join("\n")
    const btn = document.getElementById(
      "sequence-run-copy-btn",
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

  if (modalState.mode === "closed") return null

  const statusClass =
    STATUS_CLASSES[status] ?? "bg-slate-700 text-slate-300"

  const activeChildren = modalState.activeChildren ?? []

  const modalTitle =
    modalState.source === "step"
      ? "Run Step"
      : "Run Sequence"

  return (
    <Modal
      isOpen={modalState.mode === "open"}
      onClose={sendToBackground}
      ariaLabel={modalTitle}
    >
      <div
        id="sequence-run-modal"
        className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col gap-0 overflow-hidden max-h-[85dvh]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 shrink-0">
          <span className="text-slate-300 text-sm font-medium">
            {modalTitle}
          </span>
          {modalState.jobId && (
            <span
              id="sequence-run-jobid"
              className="text-xs text-slate-500 font-mono"
            >
              job {modalState.jobId}
            </span>
          )}
          <span
            id="sequence-run-status"
            className={`text-xs px-2 py-0.5 rounded font-mono ml-auto ${statusClass}`}
          >
            {status}
          </span>
          {status === "running" && (
            <button
              type="button"
              id="sequence-run-cancel-btn"
              onClick={() => void cancelJob()}
              className="text-xs bg-red-700 hover:bg-red-600 text-white px-2 py-0.5 rounded font-medium"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={sendToBackground}
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
          id="sequence-run-logs"
          className="flex-1 overflow-y-auto text-xs font-mono text-slate-300 px-4 py-3 whitespace-pre-wrap wrap-break-word min-h-0"
        >
          {logs.join("\n")}
          <div ref={logsEndRef} />
        </pre>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-700 shrink-0">
          <button
            type="button"
            id="sequence-run-copy-btn"
            onClick={() => void copyLogs()}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded border border-slate-600"
          >
            Copy logs
          </button>
          {status === "running" && (
            <button
              type="button"
              id="sequence-run-background-btn"
              onClick={sendToBackground}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded border border-slate-600"
            >
              Run in background
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
