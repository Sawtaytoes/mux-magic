import { useAtom, useSetAtom } from "jotai"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { useTolerantEventSource } from "../hooks/useTolerantEventSource"
import {
  apiRunModalAtom,
  promptModalAtom,
  runningAtom,
} from "../state/uiAtoms"
import type { RunStatus } from "../types"

// ─── Progress bar utilities (mirrors the legacy window.ProgressUtils API) ─────

type ProgressSnapshot = Record<string, unknown>

const mergeProgress = (
  snapshot: ProgressSnapshot,
  event: Record<string, unknown>,
): ProgressSnapshot => ({ ...snapshot, ...event })

const STATUS_CLASSES: Record<RunStatus, string> = {
  pending: "bg-slate-700 text-slate-300",
  running: "bg-amber-700 text-amber-100",
  completed: "bg-emerald-700 text-emerald-100",
  failed: "bg-red-700 text-red-100",
  cancelled: "bg-slate-600 text-slate-100",
}

export const ApiRunModal = () => {
  const [modalState, setModalState] =
    useAtom(apiRunModalAtom)
  const _setPromptData = useSetAtom(promptModalAtom)
  const setRunning = useSetAtom(runningAtom)

  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<RunStatus>("pending")
  const [childJobId, setChildJobId] = useState<
    string | null
  >(null)
  const [childStepId, setChildStepId] = useState<
    string | null
  >(null)
  const [childProgress, setChildProgress] =
    useState<ProgressSnapshot>({})

  const logsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs to bottom on new lines.
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({
      behavior: "smooth",
    })
  }, [])

  // Sync status + log reset when a new job opens.
  useEffect(() => {
    if (!modalState) return
    setStatus(modalState.status)
    setLogs([])
    setChildJobId(null)
    setChildStepId(null)
    setChildProgress({})
  }, [modalState?.jobId, modalState?.status, modalState]) // eslint-disable-line react-hooks/exhaustive-deps

  const parentUrl = modalState?.jobId
    ? `/jobs/${modalState.jobId}/logs`
    : null
  const childUrl = childJobId
    ? `/jobs/${childJobId}/logs`
    : null

  // ─── Parent SSE (sequence-level events) ────────────────────────────────────

  const handleParentMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type === "step-started") {
        setChildJobId((data.childJobId as string) ?? null)
        setChildStepId((data.stepId as string) ?? null)
        setChildProgress({})
        // Notify legacy step card to reset its UI via bridge.
        if (
          typeof window.mediaTools?.onStepStarted ===
          "function"
        ) {
          window.mediaTools.onStepStarted(
            data.stepId,
            data.childJobId,
          )
        }
        return
      }
      if (data.type === "step-finished") {
        setChildJobId(null)
        setChildStepId(null)
        setChildProgress({})
        if (
          typeof window.mediaTools?.onStepFinished ===
          "function"
        ) {
          window.mediaTools.onStepFinished(
            data.stepId,
            data,
          )
        }
        return
      }
      if (data.line) {
        setLogs((prev) => [...prev, data.line as string])
        return
      }
      if (data.done) {
        const finalStatus =
          (data.status as RunStatus) || "completed"
        setStatus(finalStatus)
        setChildJobId(null)
        setChildStepId(null)
        setChildProgress({})
        setRunning(false)
        if (
          typeof window.mediaTools?.onSequenceDone ===
          "function"
        ) {
          window.mediaTools.onSequenceDone()
        }
      }
    },
    [setRunning],
  )

  const handleParentDisconnected = useCallback(() => {
    setStatus("failed")
    setChildJobId(null)
    setChildStepId(null)
    setChildProgress({})
    setRunning(false)
  }, [setRunning])

  // ─── Child SSE (per-step progress events) ──────────────────────────────────

  const handleChildMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type === "progress") {
        setChildProgress((prev) =>
          mergeProgress(prev, data as ProgressSnapshot),
        )
        if (
          childStepId &&
          typeof window.mediaTools?.onStepProgress ===
            "function"
        ) {
          window.mediaTools.onStepProgress(
            childStepId,
            data,
          )
        }
        return
      }
      if (data.line && childStepId) {
        if (
          typeof window.mediaTools?.onStepLog === "function"
        ) {
          window.mediaTools.onStepLog(
            childStepId,
            data.line as string,
          )
        }
        return
      }
      if (data.done && childStepId) {
        if (
          typeof window.mediaTools?.onChildStepDone ===
          "function"
        ) {
          window.mediaTools.onChildStepDone(
            childStepId,
            data,
          )
        }
      }
    },
    [childStepId],
  )

  useTolerantEventSource<Record<string, unknown>>({
    url: parentUrl ?? "",
    enabled: parentUrl !== null,
    onMessage: handleParentMessage,
    onPossiblyDisconnected: handleParentDisconnected,
  })

  useTolerantEventSource<Record<string, unknown>>({
    url: childUrl ?? "",
    enabled: childUrl !== null,
    onMessage: handleChildMessage,
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

  if (!modalState) return null

  const statusClass =
    STATUS_CLASSES[status] ?? "bg-slate-700 text-slate-300"
  const progressPercent =
    typeof childProgress.percent === "number"
      ? Math.min(
          100,
          Math.max(0, childProgress.percent as number),
        )
      : null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: suppressed during react-migration
    // biome-ignore lint/a11y/useKeyWithClickEvents: suppressed during react-migration
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      id="api-run-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget)
          void close()
      }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col gap-0 overflow-hidden max-h-[85dvh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 shrink-0">
          <span className="text-slate-300 text-sm font-medium">
            Run Sequence
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
            // biome-ignore lint/a11y/useButtonType: suppressed during react-migration
            <button
              id="api-run-cancel-btn"
              onClick={() => void cancel()}
              className="text-xs bg-red-700 hover:bg-red-600 text-white px-2 py-0.5 rounded font-medium"
            >
              Cancel
            </button>
          )}
          {/** biome-ignore lint/a11y/useButtonType: suppressed during react-migration */}
          <button
            onClick={() => void close()}
            className="text-slate-400 hover:text-white text-base leading-none ml-1"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Child step progress */}
        {childStepId && (
          <div
            id="api-run-progress-host"
            className="px-4 py-2 border-b border-slate-700 bg-slate-900 shrink-0"
          >
            <p
              id="api-run-progress-step-label"
              className="text-xs text-slate-400 mb-1"
            >
              Step {childStepId}
            </p>
            {progressPercent !== null && (
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Log output */}
        <pre
          id="api-run-logs"
          className="flex-1 overflow-y-auto text-xs font-mono text-slate-300 px-4 py-3 whitespace-pre-wrap break-words min-h-0"
        >
          {logs.join("\n")}
          <div ref={logsEndRef} />
        </pre>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-700 shrink-0">
          {/** biome-ignore lint/a11y/useButtonType: suppressed during react-migration */}
          <button
            id="api-run-copy-btn"
            onClick={() => void copyLogs()}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded border border-slate-600"
          >
            Copy logs
          </button>
        </div>
      </div>
    </div>
  )
}
