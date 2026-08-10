import type { CommandField } from "../../commands/types"

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
    <div className="border-b border-border-default pb-3 last:border-b-0">
      <div className="flex items-baseline flex-wrap gap-2 mb-1">
        <span className="text-sm font-semibold text-content-primary">
          {field.label ?? field.name}
        </span>
        <code className="text-[11px] text-content-muted font-mono">
          {field.name}
        </code>
        <span className="text-[10px] uppercase tracking-wide text-content-secondary bg-surface-raised border border-border-default rounded px-1.5 py-0.5">
          {field.type}
        </span>
        {field.isRequired && (
          <span className="text-[10px] uppercase tracking-wide font-semibold text-intent-danger-content bg-intent-danger-surface border border-intent-danger-border rounded px-1.5 py-0.5">
            required
          </span>
        )}
      </div>
      {description ? (
        <p className="text-xs text-content-secondary leading-relaxed">
          {description}
        </p>
      ) : (
        <p className="text-xs text-content-muted italic">
          No description yet — add one in{" "}
          <code className="text-content-secondary bg-surface-sunken px-1 rounded">
            src/api/schemas.ts
          </code>
          .
        </p>
      )}
    </div>
  )
}
