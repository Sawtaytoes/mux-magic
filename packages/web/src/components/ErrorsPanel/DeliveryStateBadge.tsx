import type { WebhookDeliveryState } from "./errorAtoms"

interface DeliveryStateBadgeProps {
  state: WebhookDeliveryState
}

const stateClassMap: Record<WebhookDeliveryState, string> =
  {
    pending: "bg-slate-700 text-slate-300",
    delivered: "bg-emerald-950 text-emerald-400",
    exhausted: "bg-red-950 text-red-400",
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
