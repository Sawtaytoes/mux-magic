import type { CommandField } from "../types"

type FieldLabelProps = {
  command: string
  field: Pick<CommandField, "name" | "label" | "required">
}

export const FieldLabel = ({
  command,
  field,
}: FieldLabelProps) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: suppressed during react-migration
  <label
    className="block text-xs text-slate-400 mb-1 cursor-help"
    data-tooltip-key={`${command}:${field.name}`}
  >
    {field.label ?? field.name}
    {field.required && (
      <span className="text-red-400"> *</span>
    )}
  </label>
)
