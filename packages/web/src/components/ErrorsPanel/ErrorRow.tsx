import { Accordion } from "@charcuterie/ui"
import { useState } from "react"

import { DeliveryStateBadge } from "./DeliveryStateBadge"
import type { PersistedJobError } from "./errorAtoms"

interface ErrorRowProps {
  record: PersistedJobError
  onDismiss: () => Promise<void>
  onRedeliver: () => Promise<void>
}

const formatRelativeTime = (isoString: string) => {
  const deltaMs = Date.now() - new Date(isoString).getTime()
  const deltaSeconds = Math.floor(deltaMs / 1000)
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`
  }
  const deltaMinutes = Math.floor(deltaSeconds / 60)
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`
  }
  const deltaHours = Math.floor(deltaMinutes / 60)
  if (deltaHours < 24) {
    return `${deltaHours}h ago`
  }
  const deltaDays = Math.floor(deltaHours / 24)
  return `${deltaDays}d ago`
}

const idSuffix = (id: string) =>
  id.length > 8 ? id.slice(-8) : id

export const ErrorRow = ({
  record,
  onDismiss,
  onRedeliver,
}: ErrorRowProps) => {
  const [isConfirmingDismiss, setIsConfirmingDismiss] =
    useState(false)
  const [isRedelivering, setIsRedelivering] =
    useState(false)
  const [isDismissing, setIsDismissing] = useState(false)

  const isExhausted =
    record.webhookDelivery.state === "exhausted"

  const handleDismissClick = () => {
    setIsConfirmingDismiss(true)
  }

  const handleConfirmDismiss = () => {
    setIsDismissing(true)
    onDismiss().finally(() => {
      setIsDismissing(false)
      setIsConfirmingDismiss(false)
    })
  }

  const handleCancelDismiss = () => {
    setIsConfirmingDismiss(false)
  }

  const handleRedeliverClick = () => {
    setIsRedelivering(true)
    onRedeliver().finally(() => {
      setIsRedelivering(false)
    })
  }

  return (
    <article className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-2">
      {/* Row header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-mono">
          {idSuffix(record.id)}
        </span>
        <span className="text-xs text-slate-400">
          {formatRelativeTime(record.occurredAt)}
        </span>
        <a
          href={`/?jobId=${record.jobId}`}
          className="text-xs text-blue-400 hover:text-blue-300"
          title={`Navigate to job ${record.jobId}`}
        >
          {record.jobId}
        </a>
        <DeliveryStateBadge
          state={record.webhookDelivery.state}
        />
      </div>

      {/* Message */}
      <p className="text-sm text-slate-300 truncate">
        {record.msg}
      </p>

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        {isExhausted && (
          <button
            type="button"
            aria-label="Retry delivery"
            onClick={handleRedeliverClick}
            disabled={isRedelivering}
            className="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-400 hover:bg-amber-900/70 disabled:opacity-40"
          >
            {isRedelivering
              ? "Retrying…"
              : "↺ Retry delivery"}
          </button>
        )}

        {isConfirmingDismiss ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Confirm dismiss"
              onClick={handleConfirmDismiss}
              disabled={isDismissing}
              className="text-xs px-2 py-0.5 rounded bg-red-900/60 text-red-300 hover:bg-red-900/80 disabled:opacity-40"
            >
              {isDismissing ? "Dismissing…" : "Confirm"}
            </button>
            <button
              type="button"
              aria-label="Cancel dismiss"
              onClick={handleCancelDismiss}
              className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={handleDismissClick}
            className="text-xs px-2 py-0.5 rounded bg-slate-700/60 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            Dismiss
          </button>
        )}
      </div>

      {/*
        Was a bare "Expand"/"Collapse" `<button aria-label="Expand detail">`
        beside a conditional `<div>` — no `aria-expanded`, no
        `aria-controls`, and a name that said "Expand" while the panel was
        already open. `Accordion` says the state on the control instead of
        in the control's text, so the trigger's accessible name stays
        "Detail" and a screen reader hears whether it is open.
      */}
      <Accordion
        items={[
          {
            content: (
              <div className="space-y-2">
                {record.errorName && (
                  <div className="text-xs text-slate-400">
                    <span className="text-slate-500">
                      Error:{" "}
                    </span>
                    {record.errorName}
                  </div>
                )}
                {record.traceId && (
                  <div className="text-xs text-slate-400 font-mono">
                    <span className="text-slate-500">
                      traceId:{" "}
                    </span>
                    {record.traceId}
                  </div>
                )}
                {record.spanId && (
                  <div className="text-xs text-slate-400 font-mono">
                    <span className="text-slate-500">
                      spanId:{" "}
                    </span>
                    {record.spanId}
                  </div>
                )}
                {record.stepIndex !== undefined && (
                  <div className="text-xs text-slate-400">
                    <span className="text-slate-500">
                      stepIndex:{" "}
                    </span>
                    {record.stepIndex}
                  </div>
                )}
                {record.fileId && (
                  <div className="text-xs text-slate-400 font-mono truncate">
                    <span className="text-slate-500">
                      fileId:{" "}
                    </span>
                    {record.fileId}
                  </div>
                )}
                <div className="text-xs space-y-0.5">
                  <div className="text-slate-500">
                    Delivery:{" "}
                    {record.webhookDelivery.attempts}{" "}
                    attempt
                    {record.webhookDelivery.attempts !== 1
                      ? "s"
                      : ""}
                  </div>
                  {record.webhookDelivery.lastAttemptAt && (
                    <div className="text-slate-500">
                      Last attempt:{" "}
                      {formatRelativeTime(
                        record.webhookDelivery
                          .lastAttemptAt,
                      )}
                    </div>
                  )}
                  {record.webhookDelivery.lastError && (
                    <div className="text-red-400">
                      Last error:{" "}
                      {record.webhookDelivery.lastError}
                    </div>
                  )}
                </div>
                {record.stack && (
                  <pre className="text-xs bg-slate-950 rounded p-2 overflow-x-auto text-slate-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {record.stack}
                  </pre>
                )}
              </div>
            ),
            key: "detail",
            label: "Detail",
          },
        ]}
      />
    </article>
  )
}
