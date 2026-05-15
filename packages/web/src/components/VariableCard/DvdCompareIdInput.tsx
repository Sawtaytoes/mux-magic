import type { Variable } from "../../types"

// Input for `dvdCompareId` variables. Unlike PathValueInput, there is no
// auto-complete / picker — the value is either a slug like `spider-man-2002`,
// a numeric film id like `74759`, or a full dvdcompare.net URL. Validation
// (registry.validate) accepts all three and warns on free-text strings.
export const DvdCompareIdInput = ({
  variable,
  onValueChange,
}: {
  variable: Variable<"dvdCompareId">
  onValueChange: (value: string) => void
}) => (
  <input
    type="text"
    value={variable.value}
    placeholder="spider-man-2002 or https://dvdcompare.net/…?fid=74759"
    data-action="set-dvd-compare-id-value"
    data-pv-id={variable.id}
    onChange={(event) =>
      onValueChange(event.currentTarget.value)
    }
    className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
  />
)
