import { Accordion, Button } from "@charcuterie/ui"
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
    <article className="bg-surface-raised border border-border-default rounded-lg p-3 space-y-2">
      {/* Row header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-content-muted font-mono">
          {idSuffix(record.id)}
        </span>
        <span className="text-xs text-content-secondary">
          {formatRelativeTime(record.occurredAt)}
        </span>
        <a
          href={`/?jobId=${record.jobId}`}
          className="text-xs text-intent-accent-content hover:underline"
          title={`Navigate to job ${record.jobId}`}
        >
          {record.jobId}
        </a>
        <DeliveryStateBadge
          state={record.webhookDelivery.state}
        />
      </div>

      {/* Message */}
      <p className="text-sm text-content-secondary truncate">
        {record.msg}
      </p>

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        {isExhausted && (
          <Button
            intent="warning"
            appearance="soft"
            size="sm"
            aria-label="Retry delivery"
            onClick={handleRedeliverClick}
            isDisabled={isRedelivering}
          >
            {isRedelivering
              ? "Retrying…"
              : "↺ Retry delivery"}
          </Button>
        )}

        {isConfirmingDismiss ? (
          <span className="flex items-center gap-1">
            <Button
              intent="danger"
              appearance="soft"
              size="sm"
              aria-label="Confirm dismiss"
              onClick={handleConfirmDismiss}
              isDisabled={isDismissing}
            >
              {isDismissing ? "Dismissing…" : "Confirm"}
            </Button>
            <Button
              intent="neutral"
              appearance="soft"
              size="sm"
              aria-label="Cancel dismiss"
              onClick={handleCancelDismiss}
            >
              Cancel
            </Button>
          </span>
        ) : (
          <Button
            intent="neutral"
            appearance="ghost"
            size="sm"
            aria-label="Dismiss"
            onClick={handleDismissClick}
          >
            Dismiss
          </Button>
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
                  <div className="text-xs text-content-secondary">
                    <span className="text-content-muted">
                      Error:{" "}
                    </span>
                    {record.errorName}
                  </div>
                )}
                {record.traceId && (
                  <div className="text-xs text-content-secondary font-mono">
                    <span className="text-content-muted">
                      traceId:{" "}
                    </span>
                    {record.traceId}
                  </div>
                )}
                {record.spanId && (
                  <div className="text-xs text-content-secondary font-mono">
                    <span className="text-content-muted">
                      spanId:{" "}
                    </span>
                    {record.spanId}
                  </div>
                )}
                {record.stepIndex !== undefined && (
                  <div className="text-xs text-content-secondary">
                    <span className="text-content-muted">
                      stepIndex:{" "}
                    </span>
                    {record.stepIndex}
                  </div>
                )}
                {record.fileId && (
                  <div className="text-xs text-content-secondary font-mono truncate">
                    <span className="text-content-muted">
                      fileId:{" "}
                    </span>
                    {record.fileId}
                  </div>
                )}
                <div className="text-xs space-y-0.5">
                  <div className="text-content-muted">
                    Delivery:{" "}
                    {record.webhookDelivery.attempts}{" "}
                    attempt
                    {record.webhookDelivery.attempts !== 1
                      ? "s"
                      : ""}
                  </div>
                  {record.webhookDelivery.lastAttemptAt && (
                    <div className="text-content-muted">
                      Last attempt:{" "}
                      {formatRelativeTime(
                        record.webhookDelivery
                          .lastAttemptAt,
                      )}
                    </div>
                  )}
                  {record.webhookDelivery.lastError && (
                    <div className="text-intent-danger-content">
                      Last error:{" "}
                      {record.webhookDelivery.lastError}
                    </div>
                  )}
                </div>
                {record.stack && (
                  <pre className="text-xs bg-surface-sunken rounded p-2 overflow-x-auto text-content-secondary max-h-48 overflow-y-auto whitespace-pre-wrap">
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
