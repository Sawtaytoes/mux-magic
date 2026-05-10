import { useAtomValue, useSetAtom } from "jotai"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { useLogStream } from "../hooks/useLogStream"
import { buildBuilderUrl } from "../jobs/buildBuilderUrl"
import { commandLabel } from "../jobs/commandLabels"
import { formatEta } from "../jobs/formatBandwidth"
import { jobsAtom } from "../state/jobsAtom"
import { logsByJobIdAtom } from "../state/logsByJobIdAtom"
import { progressByJobIdAtom } from "../state/progressByJobIdAtom"
import { stepsOpenByJobIdAtom } from "../state/stepsOpenByJobIdAtom"
import type { Job } from "../types"
import { ProgressBar } from "./ProgressBar"
import { StatusBadge } from "./StatusBadge"

// ─── CopyButton ───────────────────────────────────────────────────────────────

const CopyButton = ({
  getText,
}: {
  getText: () => string
}) => {
  const [copied, setCopied] = useState(false)

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    navigator.clipboard
      .writeText(getText())
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="ml-2 text-xs text-slate-500 hover:text-slate-300 shrink-0"
    >
      {copied ? "✓ Copied" : "📋 Copy"}
    </button>
  )
}

// ─── CancelButton ─────────────────────────────────────────────────────────────

const CancelButton = ({ jobId }: { jobId: string }) => {
  const [disabled, setDisabled] = useState(false)

  const handleClick = async () => {
    setDisabled(true)
    try {
      await fetch(`/jobs/${jobId}`, { method: "DELETE" })
    } catch {
      setDisabled(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={`Cancel this job (DELETE /jobs/${jobId})`}
      className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400 hover:bg-red-900/70 disabled:opacity-40"
    >
      ⏹ Cancel
    </button>
  )
}

// ─── LogsDisclosure ───────────────────────────────────────────────────────────

const LogsDisclosure = ({
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

  // Running jobs connect immediately so new lines appear without opening the disclosure.
  useEffect(() => {
    if (jobStatus === "running") connect()
  }, [jobStatus, connect])

  // Auto-scroll to bottom when new lines arrive.
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
        <CopyButton getText={() => lines.join("\n")} />
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
          lines.map((line, index) => (
            <div key={`log-${index}-${line.slice(0, 20)}`}>{line}</div>
          ))
        )}
      </div>
    </details>
  )
}

// ─── ETA for sequence jobs ────────────────────────────────────────────────────

const useAggregateEta = (job: Job): string => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const jobs = useAtomValue(jobsAtom)
  if (job.status !== "running") return ""

  const children = Array.from(jobs.values()).filter(
    (child) => child.parentJobId === job.id,
  )
  const runningChildren = children.filter(
    (child) => child.status === "running",
  )

  let totalRemaining = 0
  let totalSpeed = 0
  let hasAnyData = false

  for (const child of runningChildren) {
    const snap = progressByJobId.get(child.id)
    if (!snap) continue
    if (
      typeof snap.bytesRemaining === "number" &&
      snap.bytesRemaining > 0 &&
      typeof snap.bytesPerSecond === "number" &&
      snap.bytesPerSecond > 0
    ) {
      totalRemaining += snap.bytesRemaining
      totalSpeed += snap.bytesPerSecond
      hasAnyData = true
    }
  }

  if (hasAnyData) {
    return formatEta(
      totalRemaining,
      totalSpeed / Math.max(runningChildren.length, 1),
    )
  }

  const ownSnap = progressByJobId.get(job.id)
  return ownSnap
    ? formatEta(
        ownSnap.bytesRemaining,
        ownSnap.bytesPerSecond,
      )
    : ""
}

// ─── StepRow ─────────────────────────────────────────────────────────────────

const StepRow = ({
  child,
  index,
}: {
  child: Job
  index: number
}) => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const snap = progressByJobId.get(child.id)

  return (
    <div className="border-l-2 border-slate-700 pl-3 py-1 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-slate-500 shrink-0">
            {index + 1}.
          </span>
          <strong className="text-sm truncate">
            {commandLabel(child.commandName)}
          </strong>
          {child.stepId && (
            <span className="text-xs text-slate-500 truncate">
              {child.stepId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={child.status} />
          {child.status === "running" && (
            <CancelButton jobId={child.id} />
          )}
        </div>
      </div>
      {child.error && (
        <p className="text-xs text-red-400 break-words">
          {child.error}
        </p>
      )}
      {child.status === "running" && snap && (
        <ProgressBar snapshot={snap} />
      )}
      {child.status !== "skipped" &&
        child.status !== "pending" && (
          <LogsDisclosure
            jobId={child.id}
            jobStatus={child.status}
          />
        )}
    </div>
  )
}

// ─── StepsDisclosure ─────────────────────────────────────────────────────────

const StepsDisclosure = ({
  jobId,
  children,
  jobStatus,
}: {
  jobId: string
  children: Job[]
  jobStatus: string
}) => {
  const stepsOpenByJobId = useAtomValue(
    stepsOpenByJobIdAtom,
  )
  const setStepsOpen = useSetAtom(stepsOpenByJobIdAtom)

  const defaultOpen =
    jobStatus === "running" || jobStatus === "pending"
  const isOpen = stepsOpenByJobId.has(jobId)
    ? // biome-ignore lint/style/noNonNullAssertion: suppressed during react-migration
      stepsOpenByJobId.get(jobId)!
    : defaultOpen

  const detailsRef = useRef<HTMLDetailsElement>(null)
  const skipNextToggleRef = useRef(isOpen)

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = isOpen
  }, [isOpen])

  const handleToggle = useCallback(
    (event: React.SyntheticEvent<HTMLDetailsElement>) => {
      if (skipNextToggleRef.current) {
        skipNextToggleRef.current = false
        return
      }
      setStepsOpen((prev) =>
        new Map(prev).set(jobId, event.currentTarget.open),
      )
    },
    [jobId, setStepsOpen],
  )

  return (
    <details ref={detailsRef} onToggle={handleToggle}>
      <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-200 py-1">
        Steps ({children.length})
      </summary>
      <div className="mt-1 space-y-2">
        {children.map((child, index) => (
          <StepRow
            key={child.id}
            child={child}
            index={index}
          />
        ))}
      </div>
    </details>
  )
}

// ─── JobCard ─────────────────────────────────────────────────────────────────

interface JobCardProps {
  job: Job
}

export const JobCard = ({ job }: JobCardProps) => {
  const progressByJobId = useAtomValue(progressByJobIdAtom)
  const jobs = useAtomValue(jobsAtom)
  const snap = progressByJobId.get(job.id)
  const eta = useAggregateEta(job)

  const children = Array.from(jobs.values()).filter(
    (child) => child.parentJobId === job.id,
  )

  const sourcePath =
    typeof job.params?.sourcePath === "string"
      ? job.params.sourcePath
      : null

  const hasParams =
    job.params !== undefined &&
    typeof job.params === "object" &&
    Object.keys(job.params).length > 0

  return (
    <article
      className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3"
      data-testid="job-card"
      data-id={job.id}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold truncate">
          {commandLabel(job.commandName ?? job.command)}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {eta && (
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {eta}
            </span>
          )}
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Meta */}
      <div className="text-xs text-slate-500 space-y-0.5">
        <div>ID: {job.id}</div>
        {job.startedAt && (
          <div>
            Started:{" "}
            {new Date(job.startedAt).toLocaleString()}
          </div>
        )}
        {job.completedAt && (
          <div>
            Completed:{" "}
            {new Date(job.completedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Progress bar for running jobs */}
      {job.status === "running" && snap && (
        <ProgressBar snapshot={snap} />
      )}

      {/* Source path shortcut */}
      {sourcePath && (
        <div
          className="text-xs text-slate-400 truncate"
          title={sourcePath}
        >
          {sourcePath}
        </div>
      )}

      {/* Params disclosure */}
      {hasParams && (
        <details>
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200 py-1 flex items-center gap-1">
            Params
            <CopyButton
              getText={() =>
                JSON.stringify(job.params, null, 2)
              }
            />
          </summary>
          <pre className="mt-1 text-xs bg-slate-950 rounded p-2 overflow-x-auto text-slate-300">
            {JSON.stringify(job.params, null, 2)}
          </pre>
        </details>
      )}

      {/* Error */}
      {job.error && (
        <p className="text-sm text-red-400 break-words">
          {job.error}
        </p>
      )}

      {/* Results disclosure */}
      {job.results && job.results.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200 py-1">
            Results ({job.results.length})
          </summary>
          <div className="mt-1 space-y-1">
            {job.results.map((result, index) => (
              <pre
                // biome-ignore lint/suspicious/noArrayIndexKey: suppressed during react-migration
                key={index}
                className="text-xs bg-slate-950 rounded p-2 overflow-x-auto text-slate-300"
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            ))}
          </div>
        </details>
      )}

      {/* Logs */}
      <LogsDisclosure
        jobId={job.id}
        jobStatus={job.status}
      />

      {/* Steps (children) */}
      {children.length > 0 && (
        <StepsDisclosure
          jobId={job.id}
          // biome-ignore lint/correctness/noChildrenProp: suppressed during react-migration
          children={children}
          jobStatus={job.status}
        />
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 pt-1">
        <a
          href={buildBuilderUrl(job)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          ✎ Open in Sequence Builder
        </a>
        {job.status === "running" && (
          <CancelButton jobId={job.id} />
        )}
      </div>
    </article>
  )
}
