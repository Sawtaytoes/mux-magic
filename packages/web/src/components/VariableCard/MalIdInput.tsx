import type { Variable } from "../../types"

// Input for `malId` variables. Accepts a numeric MAL ID (e.g. 5114)
// or a full myanimelist.net URL. Validation (registry.validate) accepts both
// and warns on free-text strings.
export const MalIdInput = ({
  variable,
  onValueChange,
}: {
  variable: Variable<"malId">
  onValueChange: (value: string) => void
}) => (
  <input
    type="text"
    value={variable.value}
    placeholder="5114 or https://myanimelist.net/anime/5114"
    data-action="set-mal-id-value"
    data-pv-id={variable.id}
    onChange={(event) =>
      onValueChange(event.currentTarget.value)
    }
    className="w-full bg-surface-raised text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-border-focus font-mono"
  />
)
