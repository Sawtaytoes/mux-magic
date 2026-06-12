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
    className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
  />
)
