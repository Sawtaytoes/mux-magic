import type { Variable } from "../../types"

// Input for `tmdbId` variables. Accepts a numeric TMDB ID (e.g. 157336)
// or a full themoviedb.org URL. Validation (registry.validate) accepts both
// and warns on free-text strings.
export const TmdbIdInput = ({
  variable,
  onValueChange,
}: {
  variable: Variable<"tmdbId">
  onValueChange: (value: string) => void
}) => (
  <input
    type="text"
    value={variable.value}
    placeholder="157336 or https://www.themoviedb.org/movie/157336"
    data-action="set-tmdb-id-value"
    data-pv-id={variable.id}
    onChange={(event) =>
      onValueChange(event.currentTarget.value)
    }
    className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
  />
)
