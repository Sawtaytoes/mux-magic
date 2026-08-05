import type { WebhookDeliveryState } from "./errorAtoms"

interface DeliveryStateBadgeProps {
  state: WebhookDeliveryState
}

const stateClassMap: Record<WebhookDeliveryState, string> =
  {
    pending: "bg-intent-neutral-surface text-intent-neutral-content",
    delivered:
      "bg-intent-success-surface text-intent-success-content",
    exhausted:
      "bg-intent-danger-surface text-intent-danger-content",
  }

export const DeliveryStateBadge = ({
  state,
}: DeliveryStateBadgeProps) => (
  <span
    className={`delivery-state-badge delivery-state-badge--${state} shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${stateClassMap[state]}`}
  >
    {state}
  </span>
)
