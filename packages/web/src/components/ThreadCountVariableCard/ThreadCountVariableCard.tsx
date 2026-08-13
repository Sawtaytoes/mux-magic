import { api } from "../../api/api"
import type { Variable } from "../../types"

// Worker 28: threadCount is now a Variable in the unified variablesAtom
// (singleton, canonical id "tc"). This card renders the numeric input that
// VariableCard.tsx dispatches to when `variable.type === "threadCount"`.
// Empty value = unset (server falls back to DEFAULT_THREAD_COUNT). The
// /system/threads read is purely informational (max ceiling + default
// placeholder); it does NOT mutate the variable's value. Fetched through
// the fleet's typed query seam (@charcuterie/logic/query) — the response
// shape is inferred from the API's generated OpenAPI schema.
export const ThreadCountVariableCard = ({
  variable,
  onValueChange,
}: {
  variable: Variable<"threadCount">
  onValueChange: (value: string) => void
}) => {
  const { data: system } = api.useQuery(
    "get",
    "/system/threads",
  )

  return (
    <div data-thread-count-var>
      <input
        type="number"
        min={1}
        max={system?.maxThreads}
        value={variable.value}
        placeholder={
          system ? String(system.defaultThreadCount) : "2"
        }
        data-action="set-thread-count-value"
        data-pv-id={variable.id}
        onChange={(event) =>
          onValueChange(event.currentTarget.value)
        }
        className="w-full bg-surface-raised text-content-primary text-xs rounded px-2 py-1.5 border border-border-default focus:outline-none focus:border-border-focus font-mono"
      />
      {system && (
        <p className="text-xs text-content-muted mt-1">
          Max: {system.maxThreads} (system ceiling). Leave
          blank to use server default (
          {system.defaultThreadCount}).
        </p>
      )}
    </div>
  )
}
