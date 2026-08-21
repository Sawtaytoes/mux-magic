import { Badge } from "@charcuterie/ui"

interface StatusBadgeProps {
  status: string
}

export type StatusIntent =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"

// Each job status → a Charcuterie intent. Replaces the old
// `Record<string, string>` of literal slate/blue/emerald/… classes;
// an unrecognised status now falls back to the neutral intent rather
// than rendering with no colour at all.
const statusIntentMap: Record<string, StatusIntent> = {
  pending: "info",
  running: "info",
  // "paused" is a UI-only derived status — set by StepCard when an
  // interactive prompt for this step's jobId is sitting in the prompt
  // atom (minimized or not). Warning (amber) matches the modal's
  // "pipeline is paused" banner so the colour reads continuously
  // across both surfaces. The badge is rendered inside a <button> in
  // StepCard so the user can re-open the minimized modal.
  paused: "warning",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
  skipped: "neutral",
  // Planned early-exit (exitIfEmpty etc.). Info reads as
  // "informational terminal" — not green-success, not red-fail, not
  // grey-skipped — distinct enough at a glance that a /jobs row marked
  // exited is recognisably different from one marked skipped.
  exited: "info",
}

/**
 * The intent a status paints with — the same answer the badge
 * uses, exported so the jobs filter can tint a chip per status
 * without spelling the map a second time.
 */
export const getStatusIntent = (
  status: string,
): StatusIntent => statusIntentMap[status] ?? "neutral"

export const StatusBadge = ({
  status,
}: StatusBadgeProps) => {
  const intent = getStatusIntent(status)
  return (
    <Badge
      intent={intent}
      appearance="soft"
      size="sm"
      className={`status-badge${status === "running" ? " animate-pulse" : ""}`}
    >
      {status}
    </Badge>
  )
}
