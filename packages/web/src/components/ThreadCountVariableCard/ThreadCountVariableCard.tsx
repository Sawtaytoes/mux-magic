import { useEffect, useState } from "react"
import { apiBase } from "../../apiBase"
import type { Variable } from "../../types"

type SystemThreads = {
  maxThreads: number
  defaultThreadCount: number
}

// Worker 28: threadCount is now a Variable in the unified variablesAtom
// (singleton, canonical id "tc"). This card renders the numeric input that
// VariableCard.tsx dispatches to when `variable.type === "threadCount"`.
// Empty value = unset (server falls back to DEFAULT_THREAD_COUNT). The
// /system/threads fetch is purely informational (max ceiling + default
// placeholder); it does NOT mutate the variable's value.
export const ThreadCountVariableCard = ({
  variable,
  onValueChange,
}: {
  variable: Variable<"threadCount">
  onValueChange: (value: string) => void
}) => {
  const [system, setSystem] =
    useState<SystemThreads | null>(null)

  useEffect(() => {
    fetch(`${apiBase}/system/threads`)
      .then((res) => res.json())
      .then((data: SystemThreads) => setSystem(data))
      .catch(() => {})
  }, [])

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
        className="w-full bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
      />
      {system && (
        <p className="text-xs text-slate-500 mt-1">
          Max: {system.maxThreads} (system ceiling). Leave
          blank to use server default (
          {system.defaultThreadCount}).
        </p>
      )}
    </div>
  )
}
