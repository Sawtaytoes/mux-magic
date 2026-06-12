import type { Variable } from "../../types"

// Input for `anidbId` variables. Accepts a numeric AniDB ID (e.g. 8160)
// or a full anidb.net URL. Validation (registry.validate) accepts both
// and warns on free-text strings.
export const AnidbIdInput = ({
  variable,
  onValueChange,
}: {
  variable: Variable<"anidbId">
  onValueChange: (value: string) => void
}) => (
  <input
    type="text"
    value={variable.value}
    placeholder="8160 or https://anidb.net/anime/8160"
    data-action="set-anidb-id-value"
    data-pv-id={variable.id}
    onChange={(event) =>
      onValueChange(event.currentTarget.value)
    }
    className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
  />
)
