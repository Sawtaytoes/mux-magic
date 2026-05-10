import type { CommandField } from "../types"

interface CommandFieldEntryProps {
  commandName: string
  field: CommandField
}

export const CommandFieldEntry = ({
  commandName,
  field,
}: CommandFieldEntryProps) => {
  const description =
    typeof window.getCommandFieldDescription === "function"
      ? window.getCommandFieldDescription({
          commandName,
          fieldName: field.name,
        })
      : ""

  return (
    <div className="border-b border-slate-800 pb-3 last:border-b-0">
      <div className="flex items-baseline flex-wrap gap-2 mb-1">
        <span className="text-sm font-semibold text-slate-100">
          {field.label ?? field.name}
        </span>
        <code className="text-[11px] text-slate-500 font-mono">
          {field.name}
        </code>
        <span className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">
          {field.type}
        </span>
        {field.required && (
          <span className="text-[10px] uppercase tracking-wide font-semibold text-red-300 bg-red-950/60 border border-red-700/50 rounded px-1.5 py-0.5">
            required
          </span>
        )}
      </div>
      {description ? (
        <p className="text-xs text-slate-300 leading-relaxed">
          {description}
        </p>
      ) : (
        <p className="text-xs text-slate-500 italic">
          No description yet — add one in{" "}
          <code className="text-slate-400 bg-slate-950 px-1 rounded">
            src/api/schemas.ts
          </code>
          .
        </p>
      )}
    </div>
  )
}
