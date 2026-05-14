import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { apiBase } from "../../apiBase"
import { threadCountAtom } from "../../state/threadCountAtom"

type SystemThreads = {
  maxThreads: number
  defaultThreadCount: number
}

export const ThreadCountVariableCard = () => {
  const [value, setValue] = useAtom(threadCountAtom)
  const [system, setSystem] =
    useState<SystemThreads | null>(null)

  useEffect(() => {
    fetch(`${apiBase}/system/threads`)
      .then((res) => res.json())
      .then((data: SystemThreads) => setSystem(data))
      .catch(() => {})
  }, [])

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const raw = event.currentTarget.value
    setValue(raw === "" ? null : raw)
  }

  return (
    <div
      data-thread-count-var
      className="col-span-full bg-slate-800/40 rounded-xl border border-dashed border-slate-600 px-4 py-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-slate-300">
          Thread count
        </span>
        <span className="text-xs text-slate-600 font-mono shrink-0">
          thread count variable
        </span>
        {value !== null && (
          <button
            type="button"
            onClick={() => setValue(null)}
            title="Clear thread count"
            aria-label="Clear thread count"
            className="ml-auto text-xs text-slate-500 hover:text-red-400 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-700"
          >
            ✕
          </button>
        )}
      </div>
      <input
        type="number"
        min={1}
        max={system?.maxThreads}
        value={value ?? ""}
        placeholder={
          system ? String(system.defaultThreadCount) : "2"
        }
        onChange={handleChange}
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
